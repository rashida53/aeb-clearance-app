import React from 'react';
import Nav from '../../components/Nav';

export default function Wajebaat() {
    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="letterHeader">
                    <h1>Waajebaat</h1>
                </div>
                <div
                    className="laagatWarning"
                    style={{
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        fontSize: '18px',
                        maxWidth: '560px',
                        margin: '0 auto',
                    }}
                >
                    <span>The Waajebaat module will be live in Rajab ul Asab 1448H</span>
                </div>
            </div>
        </>
    );
}
