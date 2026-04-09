import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import Auth from '../../../utils/auth';
import { LOGIN_USER, ADD_MEMBER } from '../gql/mutations';

const Login = () => {
    const [activeTab, setActiveTab] = useState('login');
    const [submitError, setSubmitError] = useState('');

    const {
        register: registerLogin,
        handleSubmit: handleLoginSubmit,
        formState: { errors: loginErrors },
    } = useForm();

    const {
        register: registerSignup,
        handleSubmit: handleSignupSubmit,
        formState: { errors: signupErrors },
    } = useForm();

    const [login] = useMutation(LOGIN_USER);
    const [addMember] = useMutation(ADD_MEMBER);

    if (Auth.loggedIn()) {
        return <Navigate to={Auth.getReferrer()} />;
    }

    const onLogin = async (formData) => {
        setSubmitError('');
        try {
            const { data } = await login({
                variables: {
                    email: formData.email.toLowerCase(),
                    password: formData.password,
                },
            });
            Auth.login(data.login.token);
        } catch (err) {
            setSubmitError(err.message.replace('GraphQL error: ', ''));
        }
    };

    const onSignup = async (formData) => {
        setSubmitError('');
        try {
            const { data } = await addMember({
                variables: {
                    fullName: formData.fullName,
                    email: formData.email.toLowerCase(),
                    password: formData.password,
                    its: formData.its,
                    hofIts: formData.hofIts,
                },
            });
            Auth.login(data.addMember.token);
        } catch (err) {
            setSubmitError(err.message.replace('GraphQL error: ', ''));
        }
    };

    return (
        <div className="authPage">
            <div className="authCard">
                <h1 className="authTitle">Anjuman e Burhani</h1>
                <p className="authSubtitle">Umoor Maaliyah</p>

                <div className="authTabs">
                    <button
                        className={`authTab ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('login'); setSubmitError(''); }}
                    >
                        Log In
                    </button>
                    <button
                        className={`authTab ${activeTab === 'signup' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('signup'); setSubmitError(''); }}
                    >
                        Sign Up
                    </button>
                </div>

                {submitError && (
                    <div className="formSubmitError">{submitError}</div>
                )}

                {activeTab === 'login' ? (
                    <form onSubmit={handleLoginSubmit(onLogin)} noValidate>
                        <div className="formGroup">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                {...registerLogin('email', { required: 'Email is required' })}
                            />
                            {loginErrors.email && (
                                <span className="formError">{loginErrors.email.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                {...registerLogin('password', { required: 'Password is required' })}
                            />
                            {loginErrors.password && (
                                <span className="formError">{loginErrors.password.message}</span>
                            )}
                        </div>

                        <button type="submit" className="btnPrimary">
                            Log In
                        </button>

                        <Link to="/reset" className="forgotLink">
                            Forgot password?
                        </Link>
                    </form>
                ) : (
                    <form onSubmit={handleSignupSubmit(onSignup)} noValidate>
                        <div className="formGroup">
                            <label htmlFor="signup-fullName">Full Name</label>
                            <input
                                id="signup-fullName"
                                type="text"
                                autoComplete="name"
                                {...registerSignup('fullName', { required: 'Full name is required' })}
                            />
                            {signupErrors.fullName && (
                                <span className="formError">{signupErrors.fullName.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="signup-its">ITS</label>
                            <input
                                id="signup-its"
                                type="text"
                                {...registerSignup('its', { required: 'ITS is required' })}
                            />
                            {signupErrors.its && (
                                <span className="formError">{signupErrors.its.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="signup-hofIts">HOF ITS</label>
                            <input
                                id="signup-hofIts"
                                type="text"
                                {...registerSignup('hofIts', { required: 'HOF ITS is required' })}
                            />
                            {signupErrors.hofIts && (
                                <span className="formError">{signupErrors.hofIts.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="signup-email">Email</label>
                            <input
                                id="signup-email"
                                type="email"
                                autoComplete="email"
                                {...registerSignup('email', { required: 'Email is required' })}
                            />
                            {signupErrors.email && (
                                <span className="formError">{signupErrors.email.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="signup-password">Password</label>
                            <input
                                id="signup-password"
                                type="password"
                                autoComplete="new-password"
                                {...registerSignup('password', {
                                    required: 'Password is required',
                                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                                })}
                            />
                            {signupErrors.password && (
                                <span className="formError">{signupErrors.password.message}</span>
                            )}
                        </div>

                        <button type="submit" className="btnPrimary">
                            Create Account
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
