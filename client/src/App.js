import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './utils/PrivateRoute';
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  createHttpLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import './App.css';

import Login from './pages/user/components/Login';
import Reset from './pages/user/components/Reset';
import OpenBalances from './pages/openBalances/OpenBalances';
import Letter from './pages/letter/Letter';
import Wajebaat from './pages/wajebaat/Wajebaat';
import Admin from './pages/admin/Admin';
import Review from './pages/review/Review';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('id_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset" element={<Reset />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <OpenBalances />
              </PrivateRoute>
            }
          />
          <Route
            path="/letter"
            element={
              <PrivateRoute>
                <Letter />
              </PrivateRoute>
            }
          />
          <Route
            path="/wajebaat"
            element={
              <PrivateRoute>
                <Wajebaat />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Admin />
              </PrivateRoute>
            }
          />
          <Route
            path="/review"
            element={
              <PrivateRoute requiredRole="LETTER_ADMIN">
                <Review />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </ApolloProvider>
  );
}

export default App;
