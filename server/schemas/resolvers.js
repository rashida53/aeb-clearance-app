const { Member, User, QBOpen, Approval, Letter, Masjid, Slot, Commitment, ACH, Miqaat, Pledge, Huqooq } = require('../models');
const { signToken } = require('../utils/auth');
const { AuthenticationError } = require('apollo-server-express');
const { SendHtmlEmail } = require('../utils/email');
const { encrypt, decrypt } = require('../utils/encryption');

const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if (context.user) {
                const user = await User.findOne({ _id: context.user.userId });
                const member = await Member.findOne({ its: context.user.memberIts });

                if (!user || !member) {
                    throw new AuthenticationError('User not found');
                }

                if (user.isActive === false) {
                    throw new AuthenticationError('This account is not active');
                }

                const myRoles = [].concat(member.roles).concat(user.roles);

                return {
                    userId: user._id,
                    userFullName: user.fullName,
                    userZone: user.zone,
                    memberId: member._id,
                    memberFullName: member.fullName,
                    memberEmail: member.email,
                    memberIts: member.its,
                    memberHof: member.hofIts,
                    roles: myRoles,
                };
            }
            throw new AuthenticationError('You must be logged in');
        },

        getMyOpenBalances: async (parent, { hofIts }) => {
            try {
                return await QBOpen.find({ hofIts }).sort({ due: 1 });
            } catch (err) {
                console.error('getMyOpenBalances error:', err.message);
                return [];
            }
        },

        getMyQbOpens: async (parent, { userId }) => {
            return QBOpen.find({ user: userId }).sort({ due: 1 });
        },

        getApprovalStatus: async (parent, { hofIts, userId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const [openCount, masjidRecord] = await Promise.all([
                QBOpen.countDocuments({ user: userId }),
                Masjid.findOne({ its: hofIts }),
            ]);

            const isAutoApproved = openCount === 0 && masjidRecord?.status === 'CLEAR';

            if (isAutoApproved) return { approved: true, remarks: null, approverName: null };

            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const recentApproval = await Approval.findOne(
                { hofIts, approvedAt: { $gte: thirtyDaysAgo } },
                null,
                { sort: { approvedAt: -1 } }
            );
            if (recentApproval) {
                return {
                    approved: true,
                    remarks: recentApproval.remarks,
                    approverName: recentApproval.approver,
                };
            }
            return { approved: false, remarks: null, approverName: null };
        },

        getApprovalsByRequester: async (parent, { userId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }
            return Approval.find({ requester: userId }).sort({ approvedAt: -1 });
        },

        getAllActiveUsers: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('LETTER_ADMIN') && !roles.includes('MAALIYA_VOLUNTEER')) {
                throw new AuthenticationError('Not authorized');
            }
            return User.find({ isActive: { $ne: false }, zone: { $ne: '9' } }).sort({ fullName: 1 });
        },

        getSlots: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }
            const slots = await Slot.find().sort({ date: 1, startTime: 1 });
            const userIds = slots.filter(s => s.bookedBy).map(s => s.bookedBy);
            const users = await User.find({ _id: { $in: userIds } });
            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u; });

            return slots.map(slot => ({
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: slot.bookedBy ? userMap[slot.bookedBy.toString()] || null : null,
            }));
        },

        getSlotsByDate: async (parent, { date }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const queryDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const slots = await Slot.find({
                date: { $gte: queryDate, $lt: nextDay },
            }).sort({ startTime: 1 });

            const userIds = slots.filter(s => s.bookedBy).map(s => s.bookedBy);
            const [users, commitments, qbOpens] = await Promise.all([
                User.find({ _id: { $in: userIds } }),
                Commitment.find({ user: { $in: userIds } }),
                QBOpen.find({ user: { $in: userIds } }),
            ]);

            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u; });
            const commitmentMap = {};
            commitments.forEach(c => { commitmentMap[c.user.toString()] = c; });
            const pledgeMap = {};
            qbOpens.forEach(q => {
                const uid = q.user.toString();
                if (!pledgeMap[uid]) pledgeMap[uid] = [];
                pledgeMap[uid].push(q);
            });

            return slots.map(slot => {
                const uid = slot.bookedBy ? slot.bookedBy.toString() : null;
                const user = uid ? userMap[uid] || null : null;
                const commitment = uid ? commitmentMap[uid] || null : null;
                const openPledges = uid ? (pledgeMap[uid] || []).filter(p => !p.pp) : [];

                return {
                    _id: slot._id,
                    date: slot.date.toISOString(),
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    bookedBy: user,
                    commitment: commitment ? {
                        _id: commitment._id,
                        user,
                        year: commitment.year,
                        kr: commitment.kr,
                        ut: commitment.ut,
                        schedule: commitment.schedule,
                    } : null,
                    openPledges,
                };
            });
        },

        getHOFSlotStatuses: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const [allUsers, bookedSlots] = await Promise.all([
                User.find({ isActive: { $ne: false }, zone: { $ne: '9' } }).sort({ fullName: 1 }),
                Slot.find({ bookedBy: { $ne: null } }),
            ]);

            const slotByUser = {};
            bookedSlots.forEach(slot => {
                slotByUser[slot.bookedBy.toString()] = {
                    _id: slot._id,
                    date: slot.date.toISOString(),
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                };
            });

            return allUsers.map(user => ({
                user,
                slot: slotByUser[user._id.toString()] || null,
            }));
        },

        lookupACH: async (parent, { userId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const achRecord = await ACH.findOne({ user: userId });
            if (!achRecord) return null;

            const user = await User.findById(userId);

            return {
                _id: achRecord._id,
                user,
                accountNumber: decrypt(achRecord.accountNumber),
                routingNumber: decrypt(achRecord.routingNumber),
            };
        },

        getMyWajebaatStatus: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const userId = context.user.userId;
            const [commitment, lastYearCommitment, achRecord, bookedSlot, hostingMiqaats, fmbPledge] = await Promise.all([
                Commitment.findOne({ user: userId, year: '1448-49' }),
                Commitment.findOne({ user: userId, year: '1447-48' }),
                ACH.findOne({ user: userId }),
                Slot.findOne({ bookedBy: userId }),
                Miqaat.find({
                    date: { $gte: new Date('2027-02-04'), $lte: new Date('2027-03-09') },
                    hosts: userId,
                }).sort({ date: 1 }),
                Pledge.findOne({ user: userId, period: '1448-49' }),
            ]);

            return {
                commitment: commitment ? {
                    _id: commitment._id,
                    user: await User.findById(userId),
                    year: commitment.year,
                    kr: commitment.kr,
                    ut: commitment.ut,
                    schedule: commitment.schedule,
                } : null,
                lastYearCommitment: lastYearCommitment ? {
                    _id: lastYearCommitment._id,
                    user: await User.findById(userId),
                    year: lastYearCommitment.year,
                    kr: lastYearCommitment.kr,
                    ut: lastYearCommitment.ut,
                    schedule: lastYearCommitment.schedule,
                } : null,
                ach: achRecord ? {
                    _id: achRecord._id,
                    user: await User.findById(userId),
                    accountNumber: null,
                    routingNumber: null,
                } : null,
                bookedSlot: bookedSlot ? {
                    _id: bookedSlot._id,
                    date: bookedSlot.date.toISOString(),
                    startTime: bookedSlot.startTime,
                    endTime: bookedSlot.endTime,
                    bookedBy: null,
                } : null,
                hostingMiqaats: hostingMiqaats.map(m => ({
                    _id: m._id,
                    title: m.title,
                    date: m.date.toISOString(),
                    hijriDate: m.hijriDate,
                })),
                fmbPledgeAmount: fmbPledge ? fmbPledge.amount : null,
            };
        },

        getAvailableSlots: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const slots = await Slot.find({
                bookedBy: null,
                date: { $gte: tomorrow },
            }).sort({ date: 1, startTime: 1 });

            return slots.map(slot => ({
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: null,
                group: slot.group || null,
            }));
        },
        getVolunteerSlotGroups: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const slots = await Slot.find({ group: { $ne: null } }).sort({ date: 1, startTime: 1 });

            const groupMap = {};
            slots.forEach(slot => {
                const dateKey = slot.date.toISOString().split('T')[0];
                const key = `${dateKey}|${slot.group}`;
                if (!groupMap[key]) {
                    groupMap[key] = { date: dateKey, group: slot.group, slotCount: 0, volunteerId: slot.volunteer, bookedByIds: [] };
                }
                groupMap[key].slotCount++;
                if (slot.volunteer) groupMap[key].volunteerId = slot.volunteer;
                if (slot.bookedBy) groupMap[key].bookedByIds.push(slot.bookedBy);
            });

            const allUserIds = [];
            Object.values(groupMap).forEach(g => {
                if (g.volunteerId) allUserIds.push(g.volunteerId.toString());
                g.bookedByIds.forEach(id => allUserIds.push(id.toString()));
            });
            const uniqueUserIds = [...new Set(allUserIds)];
            const users = await User.find({ _id: { $in: uniqueUserIds } });
            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u; });

            return Object.values(groupMap).map(g => ({
                date: g.date,
                group: g.group,
                slotCount: g.slotCount,
                volunteer: g.volunteerId ? userMap[g.volunteerId.toString()] || null : null,
                bookedUsers: g.bookedByIds.map(id => userMap[id.toString()]).filter(Boolean),
            }));
        },

        getMaaliyaVolunteers: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const members = await Member.find({ roles: { $in: ['MAALIYA_VOLUNTEER', 'LETTER_ADMIN'] } });
            const hofItsList = members.map(m => m.hofIts);
            return User.find({ hofIts: { $in: hofItsList }, isActive: { $ne: false } }).sort({ fullName: 1 });
        },

        getCheckInData: async (parent, { userId, year }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const [user, commitment, achRecord, openPledges, huqooq, fmbPledge] = await Promise.all([
                User.findById(userId),
                Commitment.findOne({ user: userId, year }),
                ACH.findOne({ user: userId }),
                QBOpen.find({ user: userId }).sort({ due: 1 }),
                Huqooq.findOne({ user: userId, year }),
                Pledge.findOne({ user: userId, period: year }),
            ]);

            return {
                user,
                commitment: commitment ? {
                    _id: commitment._id,
                    user,
                    year: commitment.year,
                    kr: commitment.kr,
                    ut: commitment.ut,
                    schedule: commitment.schedule,
                } : null,
                ach: achRecord ? {
                    _id: achRecord._id,
                    user,
                    accountNumber: decrypt(achRecord.accountNumber),
                    routingNumber: decrypt(achRecord.routingNumber),
                } : null,
                openPledges,
                huqooq: huqooq ? {
                    _id: huqooq._id,
                    user,
                    year: huqooq.year,
                    wajebaatAmount: huqooq.wajebaatAmount,
                    sfAmount: huqooq.sfAmount,
                    wcheck: huqooq.wcheck,
                    sfcheck: huqooq.sfcheck,
                } : null,
                fmbPledgeAmount: fmbPledge ? fmbPledge.amount : null,
            };
        },
    },

    Mutation: {
        login: async (parent, { email, password }) => {
            const member = await Member.findOne({ email: email.toLowerCase() });
            if (!member) {
                throw new AuthenticationError('Incorrect credentials');
            }

            const correctPw = await member.isCorrectPassword(password);
            if (!correctPw) {
                throw new AuthenticationError('Incorrect credentials');
            }

            const user = await User.findOne({ hofIts: member.hofIts });
            if (!user) {
                throw new AuthenticationError('No community profile found for this account');
            }

            if (user.isActive === false) {
                throw new AuthenticationError('This account is not active');
            }

            const myRoles = [].concat(member.roles).concat(user.roles);

            const loggedInUser = {
                userId: user._id,
                userFullName: user.fullName,
                userZone: user.zone,
                memberId: member._id,
                memberFullName: member.fullName,
                memberEmail: member.email,
                memberIts: member.its,
                memberHof: member.hofIts,
                roles: myRoles,
            };

            const token = signToken(loggedInUser);
            return { token, me: loggedInUser };
        },

        addMember: async (parent, { email, password, fullName, its, hofIts }) => {
            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }

            const user = await User.findOne({ hofIts });
            if (!user) {
                throw new Error('No community profile found for that HOF ITS. Please contact an admin.');
            }

            if (user.isActive === false) {
                throw new Error('This account is not active. Please contact an admin.');
            }

            const member = await Member.create({
                email: email.toLowerCase(),
                password,
                fullName,
                its,
                hofIts,
            });

            const myRoles = [].concat(member.roles).concat(user.roles);

            const loggedInUser = {
                userId: user._id,
                userFullName: user.fullName,
                userZone: user.zone,
                memberId: member._id,
                memberFullName: member.fullName,
                memberEmail: member.email,
                memberIts: member.its,
                memberHof: member.hofIts,
                roles: myRoles,
            };

            const token = signToken(loggedInUser);
            return { token, me: loggedInUser };
        },

        generateLetter: async (parent, { hofIts, hofName, reason, description }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            try {
                const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const [recentApproval, masjidRecord] = await Promise.all([
                    Approval.findOne(
                        { hofIts, approvedAt: { $gte: thirtyDaysAgo } },
                        null,
                        { sort: { approvedAt: -1 } }
                    ),
                    Masjid.findOne({ its: hofIts }),
                ]);

                const thirtyDaysAgoForLetter = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const recentLetter = await Letter.findOne({
                    hofIts,
                    generatedOn: { $gte: thirtyDaysAgoForLetter },
                });

                await Letter.create({
                    requester: context.user.userFullName,
                    approver: recentApproval ? recentApproval.approver : 'AUTO',
                    reason,
                    hofIts,
                    generatedOn: Date.now(),
                });

                const masjidNote = recentApproval ? recentApproval.masjid : 'Masjid discussion is not required at this time';

                const senderEmail = process.env.EMAIL_SENDER;
                const emailPassword = process.env.EMAIL_APP_PASSWORD;
                const recipients = process.env.LETTER_RECIPIENTS;

                if (!recentLetter && senderEmail && emailPassword && recipients) {
                    const emailHtml = `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
                        <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'PT Sans',Arial,sans-serif;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
                                <tr>
                                    <td align="center">
                                        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

                                            <tr>
                                                <td style="background-color:#00203D;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
                                                    <h1 style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#CE9C01;letter-spacing:1px;">Anjuman-e-Burhani</h1>
                                                    <p style="margin:6px 0 0;font-size:13px;color:#ffffff;letter-spacing:0.5px;">Clearance Letter</p>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style="background-color:#ffffff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

                                                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-left:4px solid #CE9C01;border-radius:4px;padding:0;margin-bottom:24px;">
                                                        <tr>
                                                            <td style="padding:16px 20px;">
                                                                <p style="margin:0 0 12px;font-size:11px;font-weight:bold;color:#CE9C01;text-transform:uppercase;letter-spacing:1px;">Name</p>
                                                                <p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#00203D;">${hofName}</p>

                                                                <p style="margin:0 0 12px;font-size:11px;font-weight:bold;color:#CE9C01;text-transform:uppercase;letter-spacing:1px;">ITS</p>
                                                                <p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#00203D;">${hofIts}</p>

                                                                <p style="margin:0 0 12px;font-size:11px;font-weight:bold;color:#CE9C01;text-transform:uppercase;letter-spacing:1px;">Reason</p>
                                                                <p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#00203D;">${reason}</p>

                                                                <p style="margin:0 0 12px;font-size:11px;font-weight:bold;color:#CE9C01;text-transform:uppercase;letter-spacing:1px;">Masjid Notes</p>
                                                                <p style="margin:0;font-size:15px;color:#00203D;line-height:1.6;">${masjidNote || '—'}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </body>
                        </html>
                    `;
                    SendHtmlEmail(
                        senderEmail,
                        emailPassword,
                        recipients,
                        'Clearance Letter Generated for Raza',
                        emailHtml
                    );
                }
            } catch (err) {
                console.error('Failed to log letter:', err);
            }

            return true;
        },

        createApproval: async (parent, { hofIts, requester, remarks, masjid }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            return Approval.create({
                hofIts,
                requester,
                approver: context.user.userFullName,
                remarks,
                masjid,
                approvedAt: Date.now(),
            });
        },

        resetPassword: async (parent, { its, hofIts, password }) => {
            const member = await Member.findOne({ its });
            if (!member) {
                throw new Error('No account found with that ITS');
            }

            if (member.hofIts !== hofIts) {
                throw new Error('HOF ITS does not match');
            }

            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }

            member.password = password;
            await member.save();

            return member;
        },

        createSlots: async (parent, { startDate, endDate, startTime, endTime, duration }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const minDate = new Date('2027-02-07');
            const maxDate = new Date('2027-03-05');
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start < minDate || end > maxDate || start > end) {
                throw new Error('Date range must be within Feb 7 - Mar 5, 2027');
            }

            const parseTime = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return h * 60 + m;
            };

            const startMinutes = parseTime(startTime);
            const endMinutes = parseTime(endTime);

            if (startMinutes >= endMinutes) {
                throw new Error('Start time must be before end time');
            }

            const dates = [];
            const current = new Date(start);
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }

            const existing = await Slot.find({
                date: { $gte: start, $lte: end },
                startTime: { $gte: startTime, $lte: endTime },
            });

            if (existing.length > 0) {
                throw new Error('Slots are conflicting, please delete existing slots');
            }

            const getSlotGroup = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                const minutes = h * 60 + m;
                if (minutes < 17 * 60) return 'After Zohr Asr';
                if (minutes < 18 * 60 + 30) return 'Before Maghrib Isha';
                return 'After Maghrib Isha';
            };

            const slots = [];
            for (const date of dates) {
                let currentMinute = startMinutes;
                while (currentMinute < endMinutes) {
                    const slotEndMinute = currentMinute + duration;
                    const sh = String(Math.floor(currentMinute / 60)).padStart(2, '0');
                    const sm = String(currentMinute % 60).padStart(2, '0');
                    const eh = String(Math.floor(slotEndMinute / 60)).padStart(2, '0');
                    const em = String(slotEndMinute % 60).padStart(2, '0');
                    const slotStartTime = `${sh}:${sm}`;

                    slots.push({
                        date,
                        startTime: slotStartTime,
                        endTime: `${eh}:${em}`,
                        bookedBy: null,
                        group: getSlotGroup(slotStartTime),
                    });
                    currentMinute += duration;
                }
            }

            const created = await Slot.insertMany(slots);
            return created.map(slot => ({
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: null,
            }));
        },

        deleteSlot: async (parent, { slotId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const slot = await Slot.findById(slotId);
            if (!slot) {
                throw new Error('Slot not found');
            }
            if (slot.bookedBy) {
                throw new Error('Cannot delete a booked slot. Cancel the signup first.');
            }

            await Slot.findByIdAndDelete(slotId);
            return true;
        },

        cancelSignup: async (parent, { slotId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const slot = await Slot.findByIdAndUpdate(
                slotId,
                { bookedBy: null },
                { new: true }
            );
            if (!slot) {
                throw new Error('Slot not found');
            }

            return {
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: null,
            };
        },

        submitCommitments: async (parent, { kr, ut, year }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const userId = context.user.userId;
            const existing = await Commitment.findOne({ user: userId, year });
            if (existing) {
                throw new Error('Commitments already submitted');
            }

            const commitment = await Commitment.create({
                user: userId,
                year,
                kr,
                ut,
            });

            const user = await User.findById(userId);
            return {
                _id: commitment._id,
                user,
                year: commitment.year,
                kr: commitment.kr,
                ut: commitment.ut,
                schedule: commitment.schedule,
            };
        },

        submitACH: async (parent, { accountNumber, routingNumber, schedule }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const userId = context.user.userId;
            const existingACH = await ACH.findOne({ user: userId });
            if (existingACH) {
                throw new Error('ACH details already submitted');
            }

            try {
                await ACH.create({
                    user: userId,
                    accountNumber: encrypt(accountNumber),
                    routingNumber: encrypt(routingNumber),
                });
            } catch (err) {
                console.error('ACH save error:', err.message);
                throw new Error('ACH could not be saved');
            }

            await Commitment.findOneAndUpdate(
                { user: userId },
                { schedule },
            );

            return true;
        },

        bookSlot: async (parent, { slotId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const userId = context.user.userId;

            const existingBooking = await Slot.findOne({ bookedBy: userId });
            if (existingBooking) {
                throw new Error('You already have a booked slot. Cancel it first.');
            }

            const slot = await Slot.findById(slotId);
            if (!slot) {
                throw new Error('Slot not found');
            }
            if (slot.bookedBy) {
                throw new Error('This slot is already booked');
            }

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            if (slot.date < tomorrow) {
                throw new Error('Cannot book a slot in the past');
            }

            slot.bookedBy = userId;
            await slot.save();

            return {
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: await User.findById(userId),
            };
        },

        claimSlotGroup: async (parent, { date, group }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const queryDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const slots = await Slot.find({ date: { $gte: queryDate, $lt: nextDay }, group });
            if (slots.length === 0) {
                throw new Error('No slots found for this group and date');
            }
            if (slots.some(s => s.volunteer && s.volunteer.toString() !== context.user.userId)) {
                throw new Error('This group is already claimed by another volunteer');
            }

            await Slot.updateMany(
                { date: { $gte: queryDate, $lt: nextDay }, group },
                { volunteer: context.user.userId }
            );
            return true;
        },

        unclaimSlotGroup: async (parent, { date, group }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const queryDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            await Slot.updateMany(
                { date: { $gte: queryDate, $lt: nextDay }, group, volunteer: context.user.userId },
                { volunteer: null }
            );
            return true;
        },

        reassignSlotGroup: async (parent, { date, group, volunteerId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const queryDate = new Date(date);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            await Slot.updateMany(
                { date: { $gte: queryDate, $lt: nextDay }, group },
                { volunteer: volunteerId }
            );
            return true;
        },

        upsertCommitmentForUser: async (parent, { userId, kr, ut, year }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const commitment = await Commitment.findOneAndUpdate(
                { user: userId, year },
                { kr, ut },
                { upsert: true, new: true }
            );

            const user = await User.findById(userId);
            return {
                _id: commitment._id,
                user,
                year: commitment.year,
                kr: commitment.kr,
                ut: commitment.ut,
                schedule: commitment.schedule,
            };
        },

        upsertACHForUser: async (parent, { userId, accountNumber, routingNumber }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            await ACH.findOneAndUpdate(
                { user: userId },
                { accountNumber: encrypt(accountNumber), routingNumber: encrypt(routingNumber) },
                { upsert: true }
            );
            return true;
        },

        upsertHuqooq: async (parent, { userId, year, wajebaatAmount, sfAmount, wcheck, sfcheck }, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }
            const roles = context.user.roles || [];
            if (!roles.includes('MAALIYA_VOLUNTEER') && !roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }

            const huqooq = await Huqooq.findOneAndUpdate(
                { user: userId, year },
                { wajebaatAmount, sfAmount, wcheck, sfcheck },
                { upsert: true, new: true }
            );

            const user = await User.findById(userId);
            return {
                _id: huqooq._id,
                user,
                year: huqooq.year,
                wajebaatAmount: huqooq.wajebaatAmount,
                sfAmount: huqooq.sfAmount,
                wcheck: huqooq.wcheck,
                sfcheck: huqooq.sfcheck,
            };
        },

        cancelMySlot: async (parent, args, context) => {
            if (!context.user) {
                throw new AuthenticationError('You must be logged in');
            }

            const userId = context.user.userId;
            const slot = await Slot.findOneAndUpdate(
                { bookedBy: userId },
                { bookedBy: null },
                { new: true }
            );

            if (!slot) {
                throw new Error('No booked slot found');
            }

            return {
                _id: slot._id,
                date: slot.date.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                bookedBy: null,
            };
        },
    },
};

module.exports = resolvers;
