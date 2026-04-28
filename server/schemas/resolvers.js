const { Member, User, QBOpen, Approval, Letter } = require('../models');
const { signToken } = require('../utils/auth');
const { AuthenticationError } = require('apollo-server-express');


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
                const recentApproval = await Approval.findOne(
                    { hofIts, approvedAt: { $gte: thirtyDaysAgo } },
                    null,
                    { sort: { approvedAt: -1 } }
                );
                if (recentApproval) {
                    await Letter.create({
                        requester: context.user.userFullName,
                        approver: recentApproval.approver,
                        reason,
                    });
                }
            } catch (err) {
                console.error('Failed to log letter:', err.message);
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
