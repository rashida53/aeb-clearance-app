import React from 'react';

export default function Hamburger({ isOpen }) {
    return (
        <button
            className="navHamburger"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
        >
            <span
                style={{
                    transform: isOpen ? 'rotate(45deg) translate(5px, 6px)' : 'rotate(0)',
                    transition: 'transform 0.3s ease',
                }}
            />
            <span
                style={{
                    opacity: isOpen ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                }}
            />
            <span
                style={{
                    transform: isOpen ? 'rotate(-45deg) translate(5px, -6px)' : 'rotate(0)',
                    transition: 'transform 0.3s ease',
                }}
            />
        </button>
    );
}
