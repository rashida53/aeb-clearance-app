require('dotenv').config();
const express = require('express');
const path = require('path');
const { clearanceDb, fmbDb } = require('./config/connection');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs, resolvers } = require('./schemas');
const { authMiddleware } = require('./utils/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: authMiddleware,
    introspection: true,
    playground: true,
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const startApolloServer = async (typeDefs, resolvers) => {
    await server.start();
    server.applyMiddleware({ app });

    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(path.join(__dirname, '../client/build')));

        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/build/index.html'));
        });
    }

    Promise.all([
        new Promise((resolve, reject) => {
            clearanceDb.once('open', resolve);
            clearanceDb.once('error', reject);
        }),
        new Promise((resolve, reject) => {
            fmbDb.once('open', resolve);
            fmbDb.once('error', reject);
        }),
    ]).then(() => {
        app.listen(PORT, () => {
            console.log(`API server running on port ${PORT}!`);
            console.log(`Use GraphQL at http://localhost:${PORT}${server.graphqlPath}`);
        });
    }).catch((err) => {
        console.error('Database connection error:', err);
        process.exit(1);
    });
};

startApolloServer(typeDefs, resolvers);
