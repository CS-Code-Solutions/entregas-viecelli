const firebaseConfig = {
    apiKey: "AIzaSyDa9ztrK6VxFVeLbP0ge6-31V05gnztjJw",
    authDomain: "reuniao-d1b29.firebaseapp.com",
    projectId: "reuniao-d1b29",
    storageBucket: "reuniao-d1b29.firebasestorage.app",
    messagingSenderId: "887897617950",
    appId: "1:887897617950:web:e96cf3cce4792e7e2b600f"
};

// Substitua pela URL gerada no Google Apps Script
const GAS_EMAIL_WEBHOOK_URL = "https://script.google.com/macros/s/SEU_ID_DE_IMPLANTACAO/exec";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Instância secundária usada exclusivamente pelo Admin para cadastrar novos usuários sem derrubar a própria sessão
function obterAuthSecundario() {
    const appSecundario = firebase.apps.find((app) => app.name === 'SecondaryAuthApp')
        || firebase.initializeApp(firebaseConfig, 'SecondaryAuthApp');
    return appSecundario.auth();
}
