require('dotenv').config({path: __dirname + '/.env'});
const headers = require('./headers');

// Constants
const BL_RECAPTCHAV2_SITE_KEY = '6LeplqUlAAAAADD_vdYJRfzMtaBpZ9ZErfETYCI0';
const { X2CAPTCHA_API_KEY, NEWRELIC, PHP_SESSION_ID, X_NEWRELIC_ID } = process.env;
const CAPTCHA_NOT_READY = 'CAPCHA_NOT_READY';
const LOG_TIME_ELAPSED = process.env.LOG_TIME_ELAPSED != 0;

// Variables with default values assigned
let crimeInterval = 42000;
let crimeIntervalCalculated = false;
let timeStamp = new Date().getTime();

// Variables
let timer;
let token;
let captchaResolveTimer;

init(); // Start the process

function init() {
    commitCrime();
}

function commitCrime() {
    token = token ? `&token=${token}` : '';
    fetch("https://www.bootleggers.us/ajax/crimes.php?action=commit", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `crime_id=7${token}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(res => {
            if(!res.error) {
                handleCrimeResponse(res);
            }
            else {
                printLog(res.error);
                if(!timer) {
                    printLog('Starting crime timer...');
                    timer = startCrimeTimer(crimeInterval);
                }
            }
        })
        .catch(err => {
            console.log(err);
        });
}

function startCrimeTimer(ms) {
    clearInterval(timer);
    return setInterval(() => {
        commitCrime();
    }, ms);
}

function handleCrimeResponse(res) {
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED!');
        handleCaptchaV2();
        return;
    }
    else {
        token = '';
        calculateCrimeInterval(res.energy);
    }
    if(res.result) {
        printResult(res.result);
    }
    if(res.jam) {
        if(res.jam['shoot-available']) {
            handleJam('shoot');
        }
        else {
            handleJam('surrender');
        }
    }
}

function calculateCrimeInterval(energy) {
    if(energy && energy.rechargeAmount && !crimeIntervalCalculated) {
        crimeInterval = Math.floor((20 / (energy.rechargeAmount / 30)) * 1000);
        crimeIntervalCalculated = true;
        if(timer) {
            clearInterval(timer);
        }
        timer = startCrimeTimer(crimeInterval);
        printLog(`Crime Interval Updated: ${crimeInterval}ms`);
    }
}

function printResult(result) {
    let rewardString = result.outcome === 'success' ? ` - ${result.loot_contents.find(i => i.class === 'cash').display}` : '';
    let timeElapsed = (new Date().getTime() - timeStamp) / 1000;
    timeStamp = new Date().getTime();
    printLog(result.float_message + rewardString + (LOG_TIME_ELAPSED ? ` [${parseFloat(timeElapsed.toFixed(2))} seconds elapsed since last crime.]` : ''));
}

function handleJam(option) {
    printLog(`Handling Jam with ${option}...`);

    fetch("https://www.bootleggers.us/ajax/crimes.php?action=handle-jam", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `choice=${option}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(res => {
            if(res.result) {
                printResult(res.result);
                if(res.result.outcome === 'busted') {
                    console.error(res.result.float_message);
                    let { arrest_length } = res.result;
                    printLog(`Jail Timer: ${arrest_length} seconds`);
                }
            }
        })
        .catch(err => {
            console.log(err);
        });
}

function handleCaptchaV2() {
    clearInterval(timer);
    let params = {
        method: 'userrecaptcha',
        googlekey: BL_RECAPTCHAV2_SITE_KEY,
        key: X2CAPTCHA_API_KEY,
        pageurl: 'https://www.bootleggers.us/crimes.php',
        json: 1
    }
    printLog('Sending Google Key to 2Captcha...');
    fetch('http://2captcha.com/in.php?' + new URLSearchParams(params))
        .then(res => res.json())
        .then(res => {
            printLog('Waiting 20 secs for Captcha resolve...');
            printLog('2Captcha Key: ' + res.request);
            setTimeout(() => {
                resumeCrimeIntervalWithRecaptchaToken(res.request);
            }, 15000);
        })
        .catch(err => {
            console.log(err);
        });
}

function resumeCrimeIntervalWithRecaptchaToken(id) {
    params = {
        id,
        key: X2CAPTCHA_API_KEY,
        action: 'get',
        json: 1
    }
    captchaResolveTimer = setInterval(() => {
        fetch('http://2captcha.com/res.php?' + new URLSearchParams(params))
            .then(res => res.json())
            .then(res => {
                handleRecaptchaToken(res);
            })
            .catch(err => {
                console.log(err);
            });
        },
        5000
    );
}

function handleRecaptchaToken(res) {
    if(res.request !== CAPTCHA_NOT_READY) {
        clearInterval(captchaResolveTimer);
        printLog('Restarting Crime Interval...');
        token = res.request;
        printLog('Recaptcha Token: ' + token);
        timer = startCrimeTimer(crimeInterval);
    }
    else {
        printLog('Waiting an additional 5 seconds for Recaptcha to complete...');
    }
}

function printLog(text) {
    let d = new Date();
    let timeString = d.toTimeString().split(' ')[0];
    console.log(`${timeString} - ${text}`);
}