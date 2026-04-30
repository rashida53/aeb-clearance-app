import decode from 'jwt-decode';

class AuthService {
    setReferrer(path) {
        localStorage.setItem('login_referrer', path);
    }

    getReferrer() {
        return localStorage.getItem('login_referrer') || '/pledges';
    }

    clearReferrer() {
        localStorage.removeItem('login_referrer');
    }

    loggedIn() {
        const token = this.getToken();
        return token && !this.isTokenExpired(token);
    }

    isClearanceAdmin() {
        const token = this.getToken();
        return token && decode(token).data.roles.includes('CLEARANCE_ADMIN');
    }

    isLetterAdmin() {
        const token = this.getToken();
        return token && decode(token).data.roles.includes('LETTER_ADMIN');
    }

    isTokenExpired(token) {
        try {
            const decoded = decode(token);
            if (decoded.exp < Date.now() / 1000) {
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    getToken() {
        return localStorage.getItem('id_token');
    }

    getProfile() {
        return decode(this.getToken());
    }

    login(idToken) {
        localStorage.setItem('id_token', idToken);
        const referrer = this.getReferrer();
        this.clearReferrer();
        window.location.assign(referrer);
    }

    logout() {
        localStorage.removeItem('id_token');
        window.location.assign('/login');
    }
}

export default new AuthService();
