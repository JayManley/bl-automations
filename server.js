import config from './config.js';
import headers from './headers.js';
import fetch from 'node-fetch';

const {
    X2CAPTCHA_API_KEY,
    NEWRELIC,
    PHP_SESSION_ID,
    X_NEWRELIC_ID,
    LOG_TIME_ELAPSED,
    COMMIT_CRIMES,
    COMMIT_GTA,
    CRIME_ID
} = config;

// Global Constants
const BL_RECAPTCHAV2_SITE_KEY = '6LeplqUlAAAAADD_vdYJRfzMtaBpZ9ZErfETYCI0';
const CAPTCHA_NOT_READY = 'CAPCHA_NOT_READY';

// Item Constants
const PACK_OF_BEER_ID = 141;
const LAUDANUM_ID = 138;
const COFFEE_AND_BEIGNETS_ID = 9;
const HOT_DOG_ID = 30;
const COLA_ID = 142;

// GTA Constants
const GTA_LOW_INCOME_NEIGHBOURHOOD_ID = 1;
const GTA_MIDDLE_CLASS_NEIGHBOURHOOD_ID = 2;

// Action Type Constants
const ACTION_TYPE_CRIME = 0;
const ACTION_TYPE_GTA = 1;

const carIdsForMelting = [
    7,8,9,13,14,15,
    17,18,24,25,26,
];

let carsForMelting = [];

// Variables with default values assigned
let timeStamp = new Date().getTime();

// Variables
let token;
let captchaResolveTimer;
let inventory;
let bullets = 0;
let handlingJam = false;

const gtaIntervals = [
    5 * 60, // 5 Mins for Lower Class Neighbourhood
    20 * 60 // 20 Mins for Middle Class Neighbourhood
];

let timers = [];

class Item {
    constructor(id, energy, cooldown) {
        this.id = id;
        this.energy = energy;
        this.cooldown = cooldown;
    }
}

class Timer {
    constructor(type, id) {
        this.type = type;
        this.id = id;
        this.resolvingCaptcha = false;
        this.enable();
        this.timeStamp = now() + timers.length;
        if(ACTION_TYPE_CRIME === type) {
            this.interval = 20;
            this.callback = commitCrime;
        }
        else if(ACTION_TYPE_GTA === type) {
            this.interval = gtaIntervals[this.id - 1];
            this.callback = commitGTA;
        }
    }
    updateTimeStamp() {
        if(this.type === ACTION_TYPE_CRIME) {
            this.timeStamp = now() + Math.floor(this.interval / 2) + Math.floor(Math.random() * this.interval);
        }
        else {
            this.timeStamp = now() + this.interval;
        }
    }
    enable() {
        if(!this.enabled) {
            this.enabled = true;
            printLog(`Timer enabled: ${this.type} - ${this.id}`);
        }
    }
    disable() {
        if(this.enabled) {
            this.enabled = false;
            printLog(`Timer disabled: ${this.type} - ${this.id}`);
        }
    }
}

init(); // Start the process

function init() {

    if(COMMIT_CRIMES) {
        timers.push(new Timer(ACTION_TYPE_CRIME, CRIME_ID));
    }

    if(COMMIT_GTA) {
        // Space out the intervals to prevent 'Unable to commit crime' error message
        timers.push(new Timer(ACTION_TYPE_GTA, GTA_LOW_INCOME_NEIGHBOURHOOD_ID));
        timers.push(new Timer(ACTION_TYPE_GTA, GTA_MIDDLE_CLASS_NEIGHBOURHOOD_ID));
        setInterval(() => {
            if(carsForMelting.length) {
                meltCar(carsForMelting.pop());
            }
        }, 5000);
    }

    if(timers.length) {
        setInterval(async () => {
            let timersResolvingCaptcha = timers.find(t => t.resolvingCaptcha);
            if(!timersResolvingCaptcha) {
                for(let i = 0; i < timers.length; i++) {
                    let t = timers[i];
                    if(t.enabled && now() >= t.timeStamp) {
                        await t.callback(t.id);
                        break;
                    }
                }
            }
        }, 2000);
    }
}

function now() {
    return Math.floor(new Date().getTime() / 1000);
}

function delayAllTimers(delay) {
    timers.forEach(t => {
        if(t.timeStamp <= now()) {
            t.timeStamp = now() + delay;
        }
    });
}

function commitCrime(id) {
    return new Promise((resolve, reject) => {
        token = token ? `&token=${token}` : '';
        fetch("https://www.bootleggers.us/ajax/crimes.php?action=commit", {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `crime_id=${id}${token}`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(async res => {
                token = ''; // We no longer need the token at this point
                let timer = timers.find(t => t.type === ACTION_TYPE_CRIME);
                if(!res.error) {
                    handleCrimeResponse(res);
                }
                else {
                    if('You are in jail!' === res.error) {
                        delayAllTimers(10); // Wait 10 seconds if in jail before trying again
                    }
                    else if('Unable to commit crime!' === res.error) {
                        timer.timeStamp = now() + 10;
                    }
                    else if('You do not have enough energy!' === res.error) {
                        console.log('Energy low, pausing timer for 2 minutes to regenerate..');
                        timer.timeStamp = now() + 120;
                    }
                    else {
                        printLog('Crime Error: ' + res.error);
                    }
                    timer.enable();
                }
                resolve(res);
            })
            .catch(err => {
                reject(err);
            });
    });
}

function commitGTA(gtaId) {
    return new Promise((resolve, reject) => {
        fetch("https://www.bootleggers.us/ajax/auto-theft.php?action=commit", {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `crime_id=${gtaId}`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(res=> {
                token = ''; // We no longer need the token at this point
                if(!res.error) {
                    handleGTAResponse(res, gtaId);
                }
                else {
                    let timer = timers.find(t => t.type === ACTION_TYPE_GTA && t.id === gtaId);
                    if('You are in jail!' === res.error) {
                        delayAllTimers(10); // Wait 10 seconds if in jail before trying again
                        printLog('GTA #' + gtaId + ': You are in jail, pausing all timers and resuming again in 10 seconds...');
                    }
                    else if(['Unable to commit crime!', 'This crime is cooling down!'].includes(res.error)) {
                        timer.timeStamp = now() + 30 * gtaId;
                        printLog(`GTA #${gtaId}: Cooling down, trying again in ${30 * gtaId} seconds...`);
                    }
                    else {
                        printLog(`GTA #${gtaId} Error: ${res.error}`);
                    }
                    timer.enable();
                }
                resolve(res);
            })
            .catch(err => {
                reject(err);
            });
    });
}

async function handleCrimeResponse(res) {
    let timer = timers.find(i => i.type === ACTION_TYPE_CRIME);
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED! Pausing timers...');
        timer.resolvingCaptcha = true;
        handleCaptchaV2(resumeCrimeIntervalWithRecaptchaToken);
        return;
    }
    else {
        calculateCrimeInterval(res.energy);
    }
    if(res.player) {
        bullets = res.player.bullets;
    }
    if(res.result) {
        printCrimeResult(res.result);
        timer.enable();
        timer.updateTimeStamp();
    }
    if(res.jam) {
        await handleJam(timer, false);
    }
}

async function handleGTAResponse(res, gtaId) {
    let timer = timers.find(i => i.type === ACTION_TYPE_GTA && i.id === gtaId);
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED!');
        timer.resolvingCaptcha = true;
        handleCaptchaV2(resumeGTAIntervalWithRecaptchaToken, gtaId);
        return;
    }
    if(res.jam) {
        await handleJam(timer, true);
    }
    else {
        if(res.player) {
            bullets = res.player.bullets;
            printLog(`Bullets: ${bullets}`);
        }
        if(res.result) {
            printGTAResult(res.result, gtaId);
            timer.enable();
            timer.updateTimeStamp();
        }
    }
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
            let energyConsumption = 20;
            energyConsumption += COMMIT_GTA ? 0.1 : 0;
            let interval = Math.floor((20 / ((energy.rechargeAmount + beerEnergy) / 30)));
            timers.find(i => i.type === ACTION_TYPE_CRIME).interval = interval;
            printLog(`Crime Interval Updated: ${interval} seconds with a random give or take ${Math.floor(interval / 2)} seconds either way.`);
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

function printCrimeResult(result) {
    let rewardString = result.outcome && result.outcome === 'success' ? ` - ${result.loot_contents.find(i => i.class === 'cash').display}` : '';
    let energyString = energyVal && maxEnergyVal ? ` - Energy: ${energyVal}/${maxEnergyVal}` : '';
    let bulletsString = ` - Bullets: ${bullets}`;
    let timeElapsed = (new Date().getTime() - timeStamp) / 1000;
    timeStamp = new Date().getTime();
    printLog('CRIME: ' + result.float_message + rewardString + energyString + bulletsString + (LOG_TIME_ELAPSED ? ` [${parseFloat(timeElapsed.toFixed(2))} seconds elapsed since last crime.]` : ''));
}

function printGTAResult(result, gtaId) {
    if(result.outcome === 'success') {
        if(!result.player_car) {
            console.log('### Car Id Error:');
            console.log(result);
        }
        else {
            let carId = result.player_car.car.id;
            if(carIdsForMelting.includes(carId)) {
                carsForMelting.push(result.player_car.id);
            }
        }
    }
    let rewardString = result.outcome && result.outcome === 'success' ? ` - ${result.player_car.car.name}` : '';
    printLog(`GTA #${gtaId}: ${result.float_message}${rewardString}`);
}

function handleJam(timer, isGTA) {
    if(handlingJam) {
        console.log('Handling jam...');
        return;
    }
    else {
        handlingJam = true;
    }
    return new Promise((resolve, reject) => {
        let choice = isGTA ? 'shoot' : 'run';
        let page = isGTA ? 'auto-theft' : 'crimes';
        printLog(`Handling Jam with ${choice}...`);
        fetch(`https://www.bootleggers.us/ajax/${page}.php?action=handle-jam`, {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `choice=${choice}`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(res => {
                if(res.result) {
                    if(isGTA) {
                        printGTAResult(res.result);
                    }
                    else {
                        printCrimeResult(res.result);
                    }
                    timer.enable();
                    timer.updateTimeStamp();
                    if(res.result.outcome === 'busted') {
                        console.error(res.result.float_message);
                        let { arrest_length } = res.result;
                        printLog(`Jail Timer: ${arrest_length} seconds`);
                    }
                }
                handlingJam = false;
                resolve(res);
            })
            .catch(err => {
                reject(err);
            });
    });
}

function handleCaptchaV2(callback, actionId) {
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
                callback(res.request, actionId);
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
                let timer = timers.find(i => i.type === ACTION_TYPE_CRIME);
                handleRecaptchaToken(res, timer);
            })
            .catch(err => {
                console.log(err);
            });
        },
        5000
    );
}

function meltCar(carId) {
    fetch("https://www.bootleggers.us/ajax/bullet-factory.php?action=melt-car", {
        "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
        "body": `playerCarIds=${carId}&orderBy=&page=1&direction=asc&keep_amount=10`,
        "method": "POST"
    });
}

function resumeGTAIntervalWithRecaptchaToken(id, gtaId) {
    let params = {
        id,
        key: X2CAPTCHA_API_KEY,
        action: 'get',
        json: 1
    }
    captchaResolveTimer = setInterval(() => {
        fetch('http://2captcha.com/res.php?' + new URLSearchParams(params))
            .then(res => res.json())
            .then(res => {
                let timer = timers.find(t => t.type === ACTION_TYPE_GTA && t.id === gtaId);
                handleRecaptchaToken(res, timer);
            })
            .catch(err => {
                console.log(err);
            });
        },
        5000
    );
}

function handleRecaptchaToken(res, timer) {
    if(res.request !== CAPTCHA_NOT_READY) {
        clearInterval(captchaResolveTimer);
        token = res.request;
        timer.resolvingCaptcha = false;
        printLog('Captcha Resolved! Resuming timers...');
    }
    else {
        printLog('Waiting an additional 5 seconds for captcha to complete...');
    }
}

function getCharacterInventory() {
    printLog('Updating inventory...');
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