import React, { lazy, Suspense } from 'react';
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

const Login = lazy(() => import('./pages/user/components/Login'));
const Reset = lazy(() => import('./pages/user/components/Reset'));
const OpenBalances = lazy(() => import('./pages/openBalances/OpenBalances'));
const Letter = lazy(() => import('./pages/letter/Letter'));
const Wajebaat = lazy(() => import('./pages/wajebaat/Wajebaat'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const Review = lazy(() => import('./pages/review/Review'));

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
        <Suspense fallback={<div className="pageContainer"><p>Loading...</p></div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset" element={<Reset />} />
          <Route
            path="/pledges"
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
        </Suspense>
      </Router>
    </ApolloProvider>
  );
}

export default App;
