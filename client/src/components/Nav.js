import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import Auth from '../utils/auth';
import { GET_ME } from '../pages/user/gql/queries';
import Hamburger from './Hamburger';

export default function Nav() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { data, error } = useQuery(GET_ME, { skip: !Auth.loggedIn() });

    if (error?.graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED')) {
        Auth.logout();
        return null;
    }

    const isLetterAdmin = data?.me?.roles?.includes('LETTER_ADMIN');
    const isMaaliyaVolunteer = isLetterAdmin || data?.me?.roles?.includes('MAALIYA_VOLUNTEER');

    const toggleMenu = () => setMenuOpen(!menuOpen);
    const closeMenu = () => setMenuOpen(false);

    const handleLogout = () => {
        Auth.logout();
    };

    return (
        <nav className="nav">
            <Link to="/pledges" className="navBrand" onClick={closeMenu}>
                AeB Umoor Maaliyah
            </Link>

            {Auth.loggedIn() && (
                <>
                    <ul className="navLinks">
                        <li>
                            <Link to="/letter" onClick={closeMenu}>Letter</Link>
                        </li>
                        <li>
                            <Link to="/wajebaat" onClick={closeMenu}>Waajebaat</Link>
                        </li>
                        {isMaaliyaVolunteer && (
                            <li>
                                <Link to="/volunteer" onClick={closeMenu}>Volunteer</Link>
                            </li>
                        )}
                        {isMaaliyaVolunteer && (
                            <li>
                                <Link to="/checkin" onClick={closeMenu}>Check-In</Link>
                            </li>
                        )}
                        {isLetterAdmin && (
                            <li>
                                <Link to="/review" onClick={closeMenu}>Review</Link>
                            </li>
                        )}
                        {isLetterAdmin && (
                            <li>
                                <Link to="/admin" onClick={closeMenu}>Admin</Link>
                            </li>
                        )}
                        <li>
                            <button onClick={handleLogout}>Sign Out</button>
                        </li>
                    </ul>

                    <Hamburger isOpen={menuOpen} onClick={toggleMenu} />

                    <div className={`navMobileMenu ${menuOpen ? 'open' : ''}`}>
                        <Link to="/letter" onClick={closeMenu}>Letter</Link>
                        <Link to="/wajebaat" onClick={closeMenu}>Waajebaat</Link>
                        {isMaaliyaVolunteer && (
                            <Link to="/volunteer" onClick={closeMenu}>Volunteer</Link>
                        )}
                        {isMaaliyaVolunteer && (
                            <Link to="/checkin" onClick={closeMenu}>Check-In</Link>
                        )}
                        {isLetterAdmin && (
                            <Link to="/review" onClick={closeMenu}>Review</Link>
                        )}
                        {isLetterAdmin && (
                            <Link to="/admin" onClick={closeMenu}>Admin</Link>
                        )}
                        <button onClick={() => { handleLogout(); closeMenu(); }}>
                            Sign Out
                        </button>
                    </div>
                </>
            )}
        </nav>
    );
}
