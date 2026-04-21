import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import Auth from '../utils/auth';
import { GET_ME } from '../pages/user/gql/queries';
import Hamburger from './Hamburger';

const showWajebaat = process.env.REACT_APP_SHOW_WAJEBAAT === 'true';

export default function Nav() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { data } = useQuery(GET_ME, { skip: !Auth.loggedIn() });
    const isLetterAdmin = data?.me?.roles?.includes('LETTER_ADMIN');

    const toggleMenu = () => setMenuOpen(!menuOpen);
    const closeMenu = () => setMenuOpen(false);

    const handleLogout = () => {
        Auth.logout();
    };

    const userName = data?.me?.memberFullName || data?.me?.userFullName || '';

    return (
        <nav className="nav">
            <Link to="/" className="navBrand" onClick={closeMenu}>
                Anjuman e Burhani Clearance
            </Link>

            {Auth.loggedIn() && (
                <>
                    <ul className="navLinks">
                        <li>
                            <Link to="/letter" onClick={closeMenu}>Letter</Link>
                        </li>
                        {showWajebaat && (
                            <li>
                                <Link to="/wajebaat" onClick={closeMenu}>Wajebaat</Link>
                            </li>
                        )}
                        {showWajebaat && (
                            <li>
                                <Link to="/admin" onClick={closeMenu}>Admin</Link>
                            </li>
                        )}
                        {isLetterAdmin && (
                            <li>
                                <Link to="/review" onClick={closeMenu}>Review</Link>
                            </li>
                        )}
                        <li>
                            <button onClick={handleLogout}>Sign Out</button>
                        </li>
                    </ul>

                    <div onClick={toggleMenu}>
                        <Hamburger isOpen={menuOpen} />
                    </div>

                    <div className={`navMobileMenu ${menuOpen ? 'open' : ''}`}>
                        <Link to="/letter" onClick={closeMenu}>Letter</Link>
                        {showWajebaat && (
                            <Link to="/wajebaat" onClick={closeMenu}>Wajebaat</Link>
                        )}
                        {showWajebaat && (
                            <Link to="/admin" onClick={closeMenu}>Admin</Link>
                        )}
                        {isLetterAdmin && (
                            <Link to="/review" onClick={closeMenu}>Review</Link>
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
