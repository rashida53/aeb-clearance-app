const { Member, User, QBOpen, Approval } = require('../models');
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
            const openCount = await QBOpen.countDocuments({ user: userId });
            if (openCount === 0) return { approved: true, remarks: null, approverName: null };

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

            const emailAccount = process.env.EMAIL_SENDER;
            const emailPassword = process.env.EMAIL_APP_PASSWORD;
            const recipients = process.env.LETTER_RECIPIENTS || emailAccount;

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 560px; margin: 0 auto; background: #ffffff; }
                        .header { background-color: #00203D; padding: 24px 32px; text-align: center; }
                        .header h1 { color: #CE9C01; font-size: 20px; margin: 0; letter-spacing: 1px; }
                        .header p { color: #ffffff; font-size: 12px; margin: 6px 0 0 0; }
                        .body { padding: 28px 32px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background-color: #00203D; color: #CE9C01; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; width: 120px; }
                        td { background-color: #f9f9f9; padding: 10px 14px; font-size: 13px; color: #333333; border-bottom: 1px solid #eeeeee; }
                        .description-box { background: #f9f9f9; border-left: 4px solid #CE9C01; padding: 14px 16px; font-size: 13px; color: #333333; line-height: 1.6; margin-top: 8px; }
                        .footer { background-color: #f0f0f0; padding: 14px 32px; text-align: center; font-size: 11px; color: #999999; margin-top: 24px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Anjuman e Burhani</h1>
                            <p>Clearance Letter</p>
                        </div>
                        <div class="body">
                            <table>
                                <tr><th>HOF ITS</th><td>${hofIts}</td></tr>
                                <tr><th>HOF Name</th><td>${hofName}</td></tr>
                                <tr><th>Reason</th><td>${reason}</td></tr>
                                <tr><th>Laagat</th><td>&nbsp;</td></tr>
                                <tr><th>Date</th><td>&nbsp;</td></tr>
                            </table>
                            <p style="font-size: 11px; color: #CE9C01; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: bold;">Description</p>
                            <div class="description-box">${description || '—'}</div>
                        </div>
                        <div class="footer">Anjuman e Burhani &mdash; Clearance Portal</div>
                    </div>
                </body>
                </html>
            `;

            if (emailPassword) {
                try {
                    SendHtmlEmail(
                        emailAccount,
                        emailPassword,
                        recipients,
                        `Clearance Letter Request — ${hofName}`,
                        emailHtml
                    );
                } catch (err) {
                    console.error('Failed to send letter email:', err.message);
                }
            }

            return true;
        },

        createApproval: async (parent, { hofIts, requester, remarks }, context) => {
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
