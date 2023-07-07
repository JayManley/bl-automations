require('dotenv').config({path: __dirname + '/.env'});

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
        "headers": {
            "accept": "*/*",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "newrelic": NEWRELIC,
            "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "traceparent": "00-e9dd23c45a8fd9f7a16a83794a07dc00-26e3b4420235f156-01",
            "tracestate": "3519484@nr=0-1-3519484-1385962235-26e3b4420235f156----1688591917116",
            "x-newrelic-id": X_NEWRELIC_ID,
            "x-requested-with": "XMLHttpRequest",
            "cookie": `PHPSESSID=${PHP_SESSION_ID}; __utmz=250505365.1684691959.19.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); __utma=250505365.1577129376.1612531537.1684691959.1688551579.20; __utmc=250505365; _ga=GA1.2.1577129376.1612531537; _gid=GA1.2.689581731.1688551579; _vid_t=3qK6SQ3cMsXdpD/QUpiJetTp1Tiug1lTtOq3jn8wSepi77bAU1NDYAlj7EfTGAN9sqgTC7zhqdHgFw==; _ga_BYR41JF2ZS=GS1.1.1688551578.2.0.1688551581.0.0.0`,
            "Referer": "https://www.bootleggers.us/crimes.php",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": `crime_id=7${token}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(res => {
            handleCrimeResponse(res);
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
        "headers": {
            "accept": "*/*",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "newrelic": NEWRELIC,
            "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "traceparent": "00-92440a77857b7b07b93c65f08408b000-09a963401b480fe0-01",
            "tracestate": "3519484@nr=0-1-3519484-1385962235-09a963401b480fe0----1688592029447",
            "x-newrelic-id": X_NEWRELIC_ID,
            "x-requested-with": "XMLHttpRequest",
            "cookie": `PHPSESSID=${PHP_SESSION_ID}; __utmz=250505365.1684691959.19.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); __utma=250505365.1577129376.1612531537.1684691959.1688551579.20; __utmc=250505365; _ga=GA1.2.1577129376.1612531537; _gid=GA1.2.689581731.1688551579; _vid_t=3qK6SQ3cMsXdpD/QUpiJetTp1Tiug1lTtOq3jn8wSepi77bAU1NDYAlj7EfTGAN9sqgTC7zhqdHgFw==; _ga_BYR41JF2ZS=GS1.1.1688551578.2.0.1688551581.0.0.0`,
            "Referer": "https://www.bootleggers.us/crimes.php",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
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
                clearInterval(timer);
                setTimeout(() => {
                    timer = startCrimeTimer(crimeInterval);
                }, arrest_length * 1000);
            }
        }
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