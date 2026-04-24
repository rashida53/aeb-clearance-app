import React from 'react';

export default function Hamburger({ isOpen, onClick }) {
    return (
        <button
            className="navHamburger"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            onClick={onClick}
        >
            <span
                style={{
                    transform: isOpen ? 'translateY(8px) rotate(45deg)' : 'none',
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
                    transform: isOpen ? 'translateY(-8px) rotate(-45deg)' : 'none',
                    transition: 'transform 0.3s ease',
                }}
            />
        </button>
    );
}
