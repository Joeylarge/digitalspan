
import { core, data, util, visual, hardware } from './lib/psychojs-2024.2.4.js';
const { PsychoJS } = core;
const { Scheduler } = util;
const { MonotonicClock } = util;

// experiment variables
let expName = 'digit_span_touch';
let expInfo = {'participant': '', 'session': '001'};
let forwardMax = 0;
let backwardMax = 0;

// PsychoJS init
const psychoJS = new PsychoJS({ debug: true });
psychoJS.openWindow({ fullscr: true, color: new util.Color([0,0,0]), units: 'height' });
psychoJS.schedule(psychoJS.gui.DlgFromDict({ dictionary: expInfo, title: expName }));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(() => (psychoJS.gui.dialogComponent.button === 'OK'),
    flowScheduler, dialogCancelScheduler);

// schedule tasks
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(runForward.bind(this));
flowScheduler.add(runBackward.bind(this));
flowScheduler.add(endExperiment.bind(this));
flowScheduler.add(quitPsychoJS, '', true);
dialogCancelScheduler.add(quitPsychoJS, '', false);

psychoJS.start({ expName, expInfo });

// collect info
async function updateInfo() {
    expInfo['date'] = MonotonicClock.getDateStr();
    util.addInfoFromUrl(expInfo);
    psychoJS.experiment.dataFileName = \`data/\${expInfo.participant}_\${expName}_\${expInfo.date}\`;
    return Scheduler.Event.NEXT;
}

let win, seqStim, keypadButtons, response = [], mouse;
function experimentInit() {
    win = psychoJS.window;
    seqStim = new visual.TextStim({ win, name: 'seq', text: '', height: 0.1, color: 'white', pos: [0,0] });
    mouse = new hardware.Mouse({ win });
    return Scheduler.Event.NEXT;
}

// show a sequence of digits
async function showSequence(seq, isBackward=false) {
    let duration = 1.0;
    for (let d of seq) {
        seqStim.text = d.toString();
        seqStim.setAutoDraw(true);
        await util.wait(duration);
        seqStim.setAutoDraw(false);
        await util.wait(0.3);
    }
    return Scheduler.Event.NEXT;
}

// get response via on-screen keypad
async function getResponse(length) {
    // create keypad
    let digits = ['1','2','3','4','5','6','7','8','9','0'];
    keypadButtons = [];
    const rows = 4, cols = 3;
    const positions = [];
    for (let i=0; i<digits.length; i++) {
        let row = Math.floor(i/3), col = i%3;
        let x = (col-1)*0.3, y = 0.3 - row*0.3;
        let btn = new visual.Rect({ win, width:0.25, height:0.25, pos:[x,y], fillColor:'grey' });
        let label = new visual.TextStim({ win, text:digits[i], height:0.1, pos:[x,y], color:'white' });
        keypadButtons.push({ btn, label, digit: digits[i] });
    }
    response = [];
    while (response.length < length) {
        // draw buttons
        keypadButtons.forEach(k => { k.btn.setAutoDraw(true); k.label.setAutoDraw(true); });
        await util.wait(0.1);
        // check for click
        let buttons = mouse.getPressed();
        if (buttons[0]) {
            let [mx, my] = mouse.getPos();
            for (let k of keypadButtons) {
                if (k.btn.contains({ x: mx, y: my })) {
                    response.push(k.digit);
                    // flash feedback
                    k.btn.fillColor = 'white'; k.label.color = 'black';
                    await util.wait(0.2);
                    k.btn.fillColor = 'grey'; k.label.color = 'white';
                    break;
                }
            }
            while (mouse.getPressed()[0]) await util.wait(0.1);
        }
    }
    // clear display
    keypadButtons.forEach(k => { k.btn.setAutoDraw(false); k.label.setAutoDraw(false); });
    return response;
}

// run forward span
async function runForward() {
    let length = 3;
    while (true) {
        let seq = Array.from({length}, () => Math.floor(Math.random()*10));
        await showSequence(seq);
        let ans = await getResponse(length);
        if (ans.join('') === seq.join('')) {
            forwardMax = length;
            length += 1;
        } else {
            break;
        }
    }
    return Scheduler.Event.NEXT;
}

// run backward span
async function runBackward() {
    let length = 3;
    while (true) {
        let seq = Array.from({length}, () => Math.floor(Math.random()*10));
        await showSequence(seq);
        let ans = await getResponse(length);
        if (ans.reverse().join('') === seq.join('')) {
            backwardMax = length;
            length += 1;
        } else {
            break;
        }
    }
    return Scheduler.Event.NEXT;
}

// end experiment: save and download results
async function endExperiment() {
    psychoJS.experiment.addData('forwardMax', forwardMax);
    psychoJS.experiment.addData('backwardMax', backwardMax);
    psychoJS.experiment.dataFileName = \`results_\${expInfo.participant}.csv\`;
    // trigger download
    let csv = 'forwardMax,backwardMax\n' + forwardMax + ',' + backwardMax;
    const blob = new Blob([csv], {type: 'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'digit_span_results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // thank you message
    seqStim.text = 'Thank you!';
    seqStim.setAutoDraw(true);
    await util.wait(3.0);
    return Scheduler.Event.NEXT;
}
