﻿import { OptionsForm } from "../../src/forms/OptionsForm.js";

const options = new OptionsForm();
document.body.appendChild(options.element);

options.addEventListener("inputBindingChanged", () => {
    console.log(options.inputBinding);
});

options.inputBinding = {
    keyButtonUp: "ArrowLeft"
};

function refreshGamepads() {
    options.gamepads = navigator.getGamepads();
}

window.addEventListeners({
    gamepadconnected: refreshGamepads,
    gamepaddisconnected: refreshGamepads
});

options.addEventListeners({
    gamepadChanged: () => {
        console.log(options.currentGamepadIndex);
    }
});


(async function () {
    const devices = await navigator.mediaDevices.enumerateDevices();
    options.audioInputDevices = devices.filter(d => d.kind === "audioinput");
    options.audioOutputDevices = devices.filter(d => d.kind === "audiooutput");
    options.videoInputDevices = devices.filter(d => d.kind === "videoinput");
});

async function show() {
    await options.showAsync();
    setTimeout(show, 1000);
}

show();