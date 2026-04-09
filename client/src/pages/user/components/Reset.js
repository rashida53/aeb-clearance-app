import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import { RESET_PASSWORD } from '../gql/mutations';

const Reset = () => {
    const [success, setSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset: formReset,
    } = useForm();

    const [resetPassword] = useMutation(RESET_PASSWORD);

    const onSubmit = async (formData) => {
        setSubmitError('');
        try {
            await resetPassword({
                variables: {
                    its: formData.its,
                    hofIts: formData.hofIts,
                    password: formData.password,
                },
            });
            formReset();
            setSuccess(true);
        } catch (err) {
            setSubmitError(err.message.replace('GraphQL error: ', ''));
        }
    };

    return (
        <div className="authPage">
            <div className="authCard">
                <h1 className="authTitle">Reset Password</h1>
                <p className="authSubtitle">Enter your ITS, HOF ITS, and a new password</p>

                {success ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#27ae60', fontWeight: 'bold', marginBottom: '20px', fontSize: '16px' }}>
                            Password updated successfully!
                        </p>
                        <Link to="/login" className="btnPrimary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        {submitError && (
                            <div className="formSubmitError">{submitError}</div>
                        )}

                        <div className="formGroup">
                            <label htmlFor="reset-its">ITS</label>
                            <input
                                id="reset-its"
                                type="text"
                                {...register('its', { required: 'ITS is required' })}
                            />
                            {errors.its && (
                                <span className="formError">{errors.its.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="reset-hofIts">HOF ITS</label>
                            <input
                                id="reset-hofIts"
                                type="text"
                                {...register('hofIts', { required: 'HOF ITS is required' })}
                            />
                            {errors.hofIts && (
                                <span className="formError">{errors.hofIts.message}</span>
                            )}
                        </div>

                        <div className="formGroup">
                            <label htmlFor="reset-password">New Password</label>
                            <input
                                id="reset-password"
                                type="password"
                                autoComplete="new-password"
                                {...register('password', {
                                    required: 'Password is required',
                                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                                })}
                            />
                            {errors.password && (
                                <span className="formError">{errors.password.message}</span>
                            )}
                        </div>

                        <button type="submit" className="btnPrimary">
                            Reset Password
                        </button>

                        <Link to="/login" className="forgotLink">
                            Back to Login
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Reset;
