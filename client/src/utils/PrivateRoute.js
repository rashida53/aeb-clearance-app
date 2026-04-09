import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Auth from './auth';

const PrivateRoute = ({ children, requiredRole, redirectPath = '/' }) => {
    const location = useLocation();

    useEffect(() => {
        if (!Auth.loggedIn()) {
            Auth.setReferrer(location.pathname);
        }
    }, [location]);

    if (!Auth.loggedIn()) {
        return <Navigate to="/login" />;
    }

    if (requiredRole) {
        const roleChecks = {
            CLEARANCE_ADMIN: Auth.isClearanceAdmin(),
        };

        if (!roleChecks[requiredRole]) {
            return <Navigate to={redirectPath} />;
        }
    }

    return children;
};

export default PrivateRoute;
