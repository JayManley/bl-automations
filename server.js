import config from './config.js';
import headers from './headers.js';
import fetch from 'node-fetch';

const {
    X2CAPTCHA_API_KEY,
    NEWRELIC,
    PHP_SESSION_ID,
    X_NEWRELIC_ID,
    COMMIT_CRIMES,
    COMMIT_GTA,
    COMMIT_MASTERMIND_CRIMES,
    CRIME_ID,
} = config;

let {
    CRIME_JAM_CHOICE,
    GTA_JAM_CHOICE
} = config;

if(null == CRIME_JAM_CHOICE) {
    CRIME_JAM_CHOICE = 'run';
}

if(null == GTA_JAM_CHOICE) {
    GTA_JAM_CHOICE = 'shoot';
}

// Global Constants
const BL_RECAPTCHAV2_SITE_KEY = '6LeplqUlAAAAADD_vdYJRfzMtaBpZ9ZErfETYCI0';
const CAPTCHA_NOT_READY = 'CAPCHA_NOT_READY';

// Item ID Constants
const PACK_OF_BEER_ID = 141;
const LAUDANUM_ID = 138;
const COFFEE_AND_BEIGNETS_ID = 9;
const HOT_DOG_ID = 30;
const COLA_ID = 142;

// GTA ID Constants
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

let cashEarned = 0;

const gtaIntervals = [
    5 * 60, // 5 Mins for Lower Class Neighbourhood
    20 * 60 // 20 Mins for Middle Class Neighbourhood
];

let timers = [];

// Init currency formatter
const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

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
            switch(id) {
                case 10:
                    this.interval = 20 * 60 // Mastermind Crimes
                    break;
                default:    
                    this.interval = 20;
            }
            this.callback = commitCrime;
        }
        else if(ACTION_TYPE_GTA === type) {
            this.interval = gtaIntervals[this.id - 1];
            this.callback = commitGTA;
        }
    }
    updateTimeStamp() {
        if(this.type === ACTION_TYPE_CRIME && this.id < 10) {
            this.timeStamp = now() + Math.floor(this.interval / 2) + Math.floor(Math.random() * this.interval);
        }
        else {
            this.timeStamp = now() + this.interval;
        }
    }
    enable() {
        if(!this.enabled) {
            this.enabled = true;
            printLog(`Timer enabled: ${getCrimeTypeName(this.type, this.id)} - ID: ${this.id}`);
        }
    }
    disable() {
        if(this.enabled) {
            this.enabled = false;
            printLog(`Timer disabled: ${getCrimeTypeName(this.type, this.id)} - ID: ${this.id}`);
        }
    }
}

init(); // Start the process

function init() {

    if(COMMIT_CRIMES) {
        timers.push(new Timer(ACTION_TYPE_CRIME, CRIME_ID));
    }
    if(COMMIT_MASTERMIND_CRIMES) {
        timers.push(new Timer(ACTION_TYPE_CRIME, 10));
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
                        await t.callback(t);
                        break;
                    }
                }
            }
        }, 2000);
    }

    setInterval(() => {
        console.log('Stats: Cash Earned so far this run: ' + usd.format(cashEarned));
    }, 300000);
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

function commitCrime(timer) {
    return new Promise((resolve, reject) => {
        token = token ? `&token=${token}` : '';
        fetch("https://www.bootleggers.us/ajax/crimes.php?action=commit", {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `crime_id=${timer.id}${token}`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(async res => {
                token = ''; // We no longer need the token at this point
                if(!res.error) {
                    handleCrimeResponse(timer, res);
                }
                else {
                    switch(res.error) {
                        case 'You are in jail!':
                            delayAllTimers(10); // Wait 10 seconds if in jail before trying again
                            break;
                        case 'Unable to commit crime!':
                            timer.timeStamp = now() + 10;
                            break;
                        case 'You do not have enough energy!':
                            console.log('Energy low, pausing timer for 2 minutes to regenerate..');
                            timer.timeStamp = now() + 120;
                            break;
                        case 'You need to deal with the cops first!':
                            handleJam(timer);
                            break;
                        case 'This crime is cooling down!': // This should only ever happen to Mastermind Crimes
                            timer.timeStamp = now() + 120;
                            printLog(`CRIME #${timer.id}: Cooling down, trying again in 2 minutes...`);
                            break;
                        case 'Invalid CAPTCHA!':
                            handleCrimeResponse(timer, res);
                            break;
                        default:
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

function commitGTA(timer) {
    return new Promise((resolve, reject) => {
        fetch("https://www.bootleggers.us/ajax/auto-theft.php?action=commit", {
            "headers": headers(NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID),
            "body": `crime_id=${timer.id}`,
            "method": "POST"
        })
            .then(res => res.json())
            .then(res=> {
                token = ''; // We no longer need the token at this point
                if(!res.error) {
                    handleGTAResponse(timer, res);
                }
                else {
                    if('You are in jail!' === res.error) {
                        delayAllTimers(10); // Wait 10 seconds if in jail before trying again
                        printLog('GTA #' + timer.id + ': You are in jail, pausing all timers and resuming again in 10 seconds...');
                    }
                    else if(['Unable to commit crime!', 'This crime is cooling down!'].includes(res.error)) {
                        timer.timeStamp = now() + 30 * timer.id;
                        printLog(`GTA #${timer.id}: Cooling down, trying again in ${30 * timer.id} seconds...`);
                    }
                    else {
                        printLog(`GTA #${timer.id} Error: ${res.error}`);
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

async function handleCrimeResponse(timer, res) {
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED! Pausing timers...');
        timer.resolvingCaptcha = true;
        handleCaptchaV2(resumeCrimeIntervalWithRecaptchaToken, timer);
        return;
    }
    else {
        calculateCrimeInterval(timer, res.energy);
    }
    if(res.player) {
        bullets = res.player.bullets;
    }
    if(res.result) {
        printCrimeResult(res.result, timer.id);
        timer.enable();
        timer.updateTimeStamp();
    }
    if(res.jam) {
        await handleJam(timer);
    }
}

async function handleGTAResponse(timer, res) {
    if(res.captchaRequired) {
        console.error('#### RECAPTCHA REQUIRED!');
        timer.resolvingCaptcha = true;
        handleCaptchaV2(resumeGTAIntervalWithRecaptchaToken, timer);
        return;
    }
    if(res.player) {
        bullets = res.player.bullets;
        printLog(`Bullets: ${bullets}`);
    }
    if(res.result) {
        printGTAResult(res.result, timer.id);
        timer.enable();
        timer.updateTimeStamp();
    }
    if(res.jam) {
        await handleJam(timer);
    }
}

let energyVal;
let maxEnergyVal;
let hasBeer;
async function calculateCrimeInterval(timer, energy) {
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
            timer.interval = interval;
            printLog(`Crime Interval Updated: ${interval} seconds with a random give or take of ${Math.floor(interval / 2)} seconds either way.`);
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

function printCrimeResult(result, id) {
    let st = [result.float_message];
    if(result.outcome && result.outcome === 'success') {
        let cashRewardString = result.loot_contents.find(i => i.class === 'cash').display;
        let cashRewardInt = Number(cashRewardString.replaceAll(/[^0-9]/g, ''));
        cashEarned += cashRewardInt;
        st.push(cashRewardString);
    }
    if(energyVal && maxEnergyVal) {
        st.push(`Energy: ${energyVal}/${maxEnergyVal}`);
    }
    st.push(`Bullets: ${bullets}`);
    printLog(`CRIME #${id}: ${st.join(' - ')}`);
}

function printGTAResult(result, id) {
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
    printLog(`GTA #${id}: ${result.float_message}${rewardString}`);
}

function handleJam(timer) {
    if(handlingJam) {
        console.log('Handling jam...');
        return;
    }
    else {
        handlingJam = true;
    }
    return new Promise((resolve, reject) => {
        let isGTA = timer.type === ACTION_TYPE_GTA;
        let choice = isGTA ? GTA_JAM_CHOICE : CRIME_JAM_CHOICE;
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
                        printGTAResult(res.result, timer.id);
                    }
                    else {
                        printCrimeResult(res.result, timer.id);
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

function handleCaptchaV2(callback, timer) {
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
                callback(res.request, timer);
            }, 15000);
        })
        .catch(err => {
            console.log(err);
        });
}

function resumeCrimeIntervalWithRecaptchaToken(id, timer) {
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

function resumeGTAIntervalWithRecaptchaToken(id, timer) {
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

function getCrimeTypeName(type, id) {
    if(ACTION_TYPE_CRIME === type && id < 10) {
        return 'Crime';
    }
    else if(ACTION_TYPE_CRIME === type && id >= 10) {
        return 'Mastermind Crime';
    }
    else if(ACTION_TYPE_GTA === type) {
        return 'GTA';
    }
    else {
        return 'Invalid Crime';
    }
}

function printLog(text) {
    let d = new Date();
    let timeString = d.toTimeString().split(' ')[0];
    console.log(`${timeString} - ${text}`);
}