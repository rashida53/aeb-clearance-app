const { Member, User, QBOpen, Approval, Letter, Masjid } = require('../models');
const { signToken } = require('../utils/auth');
const { AuthenticationError } = require('apollo-server-express');
const { SendHtmlEmail } = require('../utils/email');

const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if (context.user) {
                const user = await User.findOne({ _id: context.user.userId });
                const member = await Member.findOne({ its: context.user.memberIts });

                if (!user || !member) {
                    throw new AuthenticationError('User not found');
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
            if (!context.user.roles || !context.user.roles.includes('LETTER_ADMIN')) {
                throw new AuthenticationError('Not authorized');
            }
            return User.find({ isActive: { $ne: false } }).sort({ fullName: 1 });
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
    },
};

module.exports = resolvers;
