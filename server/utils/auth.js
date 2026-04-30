const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'clearance-dev-secret';
const expiration = '14d';

module.exports = {
    authMiddleware: function ({ req }) {
        let token = req.body.token || req.query.token || req.headers.authorization;

        if (req.headers.authorization) {
            token = token.split(' ').pop().trim();
        }

        if (!token) {
            return req;
        }

        try {
            const { data } = jwt.verify(token, secret, { maxAge: expiration });
            req.user = data;
        } catch {
            console.log('Invalid token');
        }

        return req;
    },
    signToken: function (loggedInUser) {
        const payload = loggedInUser;
        return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
    },
};
