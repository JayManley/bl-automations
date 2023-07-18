import dotenv from 'dotenv'
dotenv.config({path: './.env'});
import headers from './headers.mjs';
import fetch from 'node-fetch';

// Constants
const BL_RECAPTCHAV2_SITE_KEY = '6LeplqUlAAAAADD_vdYJRfzMtaBpZ9ZErfETYCI0';
const { X2CAPTCHA_API_KEY, NEWRELIC, PHP_SESSION_ID, X_NEWRELIC_ID } = process.env;
const CAPTCHA_NOT_READY = 'CAPCHA_NOT_READY';
const LOG_TIME_ELAPSED = process.env.LOG_TIME_ELAPSED != 0;
const COMMIT_CRIMES = process.env.COMMIT_CRIMES != 0;
const COMMIT_GTA = process.env.COMMIT_GTA != 0;
const PACK_OF_BEER_ID = 141;
const LAUDANUM_ID = 138;
const CRIME_ID = 8; // Change this to commit different crime indexes
const GTA_LOW_INCOME_NEIGHBOURHOOD_ID = 1;
const GTA_MIDDLE_CLASS_NEIGHBOURHOOD_ID = 2;

// Variables with default values assigned
let crimeInterval = 42000;
let timeStamp = new Date().getTime();

// Variables
let timer;
let gtaTimers = [];
let token;
let captchaResolveTimer;
let inventory;
let bullets = 0;

init(); // Start the process

function init() {
    if(COMMIT_CRIMES) {
        commitCrime();
    }
    // if(COMMIT_GTA) {
    //     commitGTA(GTA_LOW_INCOME_NEIGHBOURHOOD_ID);
    //     commitGTA(GTA_MIDDLE_CLASS_NEIGHBOURHOOD_ID);
    // }
}

function commitGTA(id) {
    fetch("https://www.bootleggers.us/ajax/auto-theft.php?action=commit", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `crime_id=${id}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(res=> {
            token = ''; // We no longer need the token at this point
            if(!res.error) {
                handleGTAResponse(res);
            }
            else {
                printLog(res.error);
                if(!gtaTimers[id - 1]) {
                    printLog(`Starting GTA #${id} timer...`);
                    let i;
                    if(id === GTA_LOW_INCOME_NEIGHBOURHOOD_ID) {
                        i = 5 * 60 * 1000; // 5 Mins for Lower Class Neighbourhood
                    }
                    else if(id === GTA_MIDDLE_CLASS_NEIGHBOURHOOD_ID) {
                        i = 20 * 60 * 1000; // 20 Mins for Lower Class Neighbourhood
                    }
                    i += 1000; // Add a second onto the interval to cater for any latency
                    gtaTimers[id] = startGTATimer(id, i);
                }
            }
        })
        .catch(err => {
            console.log(err);
        });
}

function commitCrime() {
    token = token ? `&token=${token}` : '';
    fetch("https://www.bootleggers.us/ajax/crimes.php?action=commit", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `crime_id=${CRIME_ID}${token}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(res => {
            token = ''; // We no longer need the token at this point
            if(!res.error) {
                handleCrimeResponse(res);
            }
            else if(res.error === 'You need to deal with the cops first!') {
                if(bullets >= 10) {
                    handleJam('shoot');
                }
                else {
                    handleJam('surrender');
                }
            }
            else {
                printLog(res.error);
            }
            if(!timer) {
                printLog('Starting crime timer...');
                timer = startCrimeTimer(crimeInterval);
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

function startGTATimer(id, ms) {
    clearInterval(gtaTimers[id]);
    return setInterval(() => {
        commitGTA(id);
    }, ms);
}

function handleCrimeResponse(res) {
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED!');
        handleCaptchaV2();
        return;
    }
    else {
        calculateCrimeInterval(res.energy);
    }
    if(res.player) {
        bullets = res.player.bullets;
    }
    if(res.result) {
        handleCrimeResult(res.result);
    }
    if(res.jam) {
        if(Math.abs(res.jam['shoot-bullets']) <= bullets) {
            bullets -= Math.abs(res.jam['shoot-bullets']);
            handleJam('shoot');
        }
        else {
            handleJam('surrender');
        }
    }
}

function handleGTAResponse(res) {
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED!');
        handleCaptchaV2();
        return;
    }
    else {
        calculateCrimeInterval(res.energy);
    }
    if(res.player) {
        bullets = res.player.bullets;
        printLog(`Bullets: ${bullets}`);
    }
    if(res.result) {
        handleCrimeResult(res.result);
    }
    if(res.jam) {
        if(Math.abs(res.jam['shoot-bullets']) <= bullets) {
            bullets -= Math.abs(res.jam['shoot-bullets']);
            handleJam('shoot');
        }
        else {
            handleJam('surrender');
        }
    }
}

function handleCrimeResult(result) {
    printResult(result);
}

let energyVal;
let maxEnergyVal;
let hasBeer;
async function calculateCrimeInterval(energy) {
    if(!inventory) {
        inventory = await getCharacterInventory();
    }
    let findBeer = inventory.find(i => i.item.id === PACK_OF_BEER_ID);
    if(energy) {
        energyVal = energy.value;
        maxEnergyVal = energy.maxValue;
        if(!hasBeer || (findBeer && hasBeer.id !== findBeer.id)) {
            hasBeer = findBeer;
            let beerEnergy = hasBeer ? 20 : 0;
            crimeInterval = Math.floor((20 / ((energy.rechargeAmount + beerEnergy) / 30)) * 1000);
            if(timer) {
                clearInterval(timer);
            }
            timer = startCrimeTimer(crimeInterval);
            printLog(`Crime Interval Updated: ${crimeInterval}ms`);
        }
        if(hasBeer && maxEnergyVal - energyVal > 420) {
            consumeItem(findBeer.id);
        }
    }
}

// Consume Laudanum
consumeLaudanum();
async function consumeLaudanum() {
    inventory = await getCharacterInventory();
    let laudanum = inventory.find(i => i.item.id === LAUDANUM_ID);
    if(laudanum) {
        consumeItem(laudanum.id);
    }
}
setInterval(async () => {
    consumeLaudanum();
}, 20.1 * 60 * 1000)

function consumeItem(id) {
    fetch("https://www.bootleggers.us/ajax/player.php?action=use-item", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `item_id=${id}`,
        "method": "POST"
    })
        .then(res => res.json())
        .then(async res => {
            if(res.success && res.result && res.result.outcome === 'success') {
                if(res.result.message) {
                    printLog(res.result.message);
                }
                if(res.result.playerEnergy) {
                    energyVal = res.result.playerEnergy.value;
                    maxEnergyVal = res.result.playerEnergy.maxValue;
                }
                inventory = await getCharacterInventory();
            }
        })
        .catch(err => {
            console.log(err);
        });
}

function printResult(result) {
    let rewardString = result.outcome && result.outcome === 'success' ? ` - ${result.loot_contents.find(i => i.class === 'cash').display}` : '';
    let energyString = energyVal && maxEnergyVal ? ` - Energy: ${energyVal}/${maxEnergyVal}` : '';
    let bulletsString = ` - Bullets: ${bullets}`;
    let timeElapsed = (new Date().getTime() - timeStamp) / 1000;
    timeStamp = new Date().getTime();
    printLog(result.float_message + rewardString + energyString + bulletsString + (LOG_TIME_ELAPSED ? ` [${parseFloat(timeElapsed.toFixed(2))} seconds elapsed since last crime.]` : ''));
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
                handleCrimeResult(res.result);
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
    const params = {
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

function getCharacterInventory() {
    printLog('Fetching Character Inventory...');
    return new Promise((resolve, reject) => {
        fetch("https://www.bootleggers.us/ajax/player.php?action=get-character-data", {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `type=items`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(res => {
                if(res.success && res.items && res.items.player_items) {
                    resolve(res.items.player_items);
                }
                else {
                    reject(res);
                }
            })
            .catch(err => {
                reject(err);
            });
    });
}

function printLog(text) {
    let d = new Date();
    let timeString = d.toTimeString().split(' ')[0];
    console.log(`${timeString} - ${text}`);
}