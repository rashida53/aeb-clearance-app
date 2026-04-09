import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import Auth from '../utils/auth';
import { GET_ME } from '../pages/user/gql/queries';
import Hamburger from './Hamburger';

export default function Nav() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { data } = useQuery(GET_ME, { skip: !Auth.loggedIn() });

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
                        {userName && (
                            <li>
                                <span style={{ color: 'var(--color-gold)', fontSize: '15px' }}>
                                    {userName}
                                </span>
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
                        {userName && (
                            <span style={{ color: 'var(--color-gold)', fontSize: '16px', paddingBottom: '8px' }}>
                                {userName}
                            </span>
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
