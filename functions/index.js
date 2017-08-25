'use strict';

console.log('Loading function...');
console.log('Loading dependencies...');
const functions = require('firebase-functions');
const admin = require("firebase-admin");
const cors = require('cors')({origin: true});
const axios = require('axios');
const serviceAccount = require('./info.json');

exports.auth = functions.https.onRequest((req, res) => {

    if (req.method !== 'GET') {
        res.status(403).send('Forbidden!');
        return;
    }

    cors(req, res, () => {
        return main(req, res);
    });
});

function main(req, res){

    //Check for pnut token.
    console.log('Retrieving token...');
    let token = req.query.token;

    if(!token){
        res.status(403).send('Forbidden!  No token sent.');
        return;
    }

    //Check for show.
    console.log('Retrieving show...');
    let show = req.query.show;

    console.log('Configuring Firebase...');
    let app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: functions.config().mndp.database_url
    });

    let fb = admin.database();

    //Get a reference to
    let auth = admin.auth();

    return processToken(token, show, fb, auth)
        .then(userDetails => {
            let result = {
                token: userDetails.customToken,
                user: userDetails.user
            };

            res.status(200).send(result);
            return app.delete();
        })
        .catch(error => {
            console.log(error);

            let message = error.message ? error.message : 'Error!';
            let code = error.returnCode ? error.returnCode : 500;
            res.status(code).send(message);
            return app.delete();
        });
}

function processToken(token, show, fb, auth){

    return validatePnutToken(token)
        .then(user => processUser(user, show, fb))
        .then(userDetails => generateFirebaseToken(userDetails, auth))
        .then(userDetails => { return userDetails; });
}

function validatePnutToken(token){
    console.log('Validating token...');
    console.log('Initializing axios...');
    axios.defaults.baseURL = 'https://api.pnut.io';
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

    console.log('Getting user data...');
    return axios.get('/v0/users/me')
        .then(function (response) {
            if(response.data.meta.code !== 200){
                console.log('Error validating token...');
                throw {
                    message: response.data.meta.error_message
                    , returnCode: response.data.meta.code
                };
            }

            return response.data.data;
        });
}

function processUser(user, show, fb){
    console.log('Processing user ' + user.username + '...');
    //Check if user is DJ of show.

    if(!show){
        console.log('No show found...');
        return { user: user };
    }

    console.log('Show found.  Checking if user is valid DJ for ' + show + '...');

    let djsRef = fb.ref('shows/djs/' + show);

    return djsRef.once('value').then(snapshot =>{
        let isDj = false;
        snapshot.forEach(x =>{
            isDj = x.val() === user.username;
            if(isDj)
                return false;
        });

        if(isDj){
            console.log(user.username + ' is DJ for ' + show + '...');
            return {
                user: user,
                mondaynightdanceparty: true
            };
        }

        return { user: user };
    });
}

function generateFirebaseToken(userDetails, auth){
    console.log('Generating Firebase token...');

    if(userDetails.mondaynightdanceparty){
        let additionalClaims = { mondaynightdanceparty: true };

        return auth.createCustomToken(userDetails.user.username, additionalClaims)
            .then(customToken => {
                userDetails.customToken = customToken;
                return userDetails;
            });
    }

    return auth.createCustomToken(userDetails.user.username)
        .then(customToken => {
            userDetails.customToken = customToken;
            return userDetails;
        });
}
