﻿import {
    Table,
    TBody,
    TR,
    TD,
    Span,
    Button,

    clear,
    Div
} from "../src/html/tags.js";

import {
    style,
    colSpan,
    monospaceFamily
} from "../src/html/attrs.js";

import {
    onClick
} from "../src/html/evts.js";


class TestOutputResultsEvent extends Event {
    constructor(table, stats) {
        super("testoutputresults");
        this.table = table;
        this.stats = stats;
    }
}

class TestOutput extends EventTarget {
    constructor(...CaseClasses) {
        super();
        this.CaseClasses = CaseClasses;
    }

    async run(className, testName) {
        const testRunner = new TestRunner(...this.CaseClasses);

        testRunner.addEventListener("testrunnerresults", (evt) => {
            const table = evt.results;
            let totalFound = 0,
                totalRan = 0,
                totalCompleted = 0,
                totalIncomplete = 0,
                totalSucceeded = 0,
                totalFailed = 0;

            for (let testCaseName in table) {
                const testCase = table[testCaseName];
                for (let testName in testCase) {
                    const test = testCase[testName];
                    ++totalFound;

                    if (test.state & TestState.started) {
                        ++totalRan;
                    }

                    if (test.state & TestState.completed) {
                        ++totalCompleted;
                    }
                    else {
                        ++totalIncomplete;
                    }

                    if (test.state & TestState.succeeded) {
                        ++totalSucceeded;
                    }

                    if (test.state & TestState.failed) {
                        ++totalFailed;
                    }
                }
            }

            const stats = {
                totalFound,
                totalRan,
                totalCompleted,
                totalIncomplete,
                totalSucceeded,
                totalFailed
            };

            this.dispatchEvent(new TestOutputResultsEvent(table, stats));
        });

        testRunner.run(className, testName);
    }
}

export class ConsoleTestOutput extends TestOutput {
    constructor(TestRunnerClass, ...CaseClasses) {
        super(TestRunnerClass, ...CaseClasses);
        this.addEventListener("testoutputresults", (evt) => {
            console.clear();
            for (let testCaseName in evt.table) {
                console.group(testCaseName);
                console.table(evt.table[testCaseName]);
                console.groupEnd();
            }
            console.table(evt.stats);

            let foundLabel = "%c",
                failedLabel = "%c",
                succeededLabel = "%c";
            while (evt.stats.totalFound > 0) {
                if (evt.stats.totalFailed > 0) {
                    failedLabel += "o";
                    --evt.stats.totalFailed;
                }
                else if (evt.stats.totalSucceeded > 0) {
                    succeededLabel += "o";
                    --evt.stats.totalSucceeded;
                }
                else {
                    foundLabel += "o";
                }
                --evt.stats.totalFound;
            }

            console.log(succeededLabel + failedLabel + foundLabel, "color: green", "color: red", "color: grey");
        });
    }
}

function bar(color, width) {
    return style({
        backgroundColor: color,
        color,
        width
    });
}

function refresher(thunk) {
    return TD(Button(
        onClick(thunk),
        "\u{1F504}\u{FE0F}"));
}

export class HtmlTestOutput extends TestOutput {
    constructor(...CaseClasses) {
        super(...CaseClasses);

        this.element = Div(style({
            overflowY: "scroll"
        }));

        const draw = (evt) => {
            const s = Math.round(100 * evt.stats.totalSucceeded / evt.stats.totalFound),
                f = Math.round(100 * evt.stats.totalFailed / evt.stats.totalFound),
                t = Math.round(100 * (evt.stats.totalFound - evt.stats.totalSucceeded - evt.stats.totalFailed) / evt.stats.totalFound),
                basicStyle = style({
                    display: "inline-block",
                    overflow: "hidden",
                    height: "1em"
                }),
                table = Table(
                    style({
                        fontFamily: monospaceFamily,
                        width: "100%"
                    }),
                    TBody(
                        TR(
                            TD(
                                colSpan(3),
                                style({ height: "2em" }),
                                Span(basicStyle, bar("green", s + "%")),
                                Span(basicStyle, bar("red", f + "%")),
                                Span(basicStyle, bar("grey", t + "%"))),
                            refresher(() =>
                                this.run())),
                        TR(
                            TD("Name"),
                            TD("Status"),
                            TD(),
                            TD("Rerun")))),
                tbody = table.querySelector("tbody");

            for (let testCaseName in evt.table) {
                tbody.appendChild(TR(
                    TD(
                        colSpan(3),
                        testCaseName),
                    refresher(() =>
                        this.run(testCaseName))));

                for (let testName in evt.table[testCaseName]) {
                    const e = evt.table[testCaseName][testName];
                    tbody.appendChild(TR(
                        TD(testName),
                        TD(makeStatus(e.state)),
                        TD(e.messages.join(", ")),
                        refresher(() =>
                            this.run(testCaseName, testName))));
                }
            }

            clear(this.element);
            this.element.appendChild(table);
        };

        this.addEventListener("testoutputresults", draw);
    }
}

const TestState = {
    found: 0,
    started: 1,
    succeeded: 2,
    failed: 4,
    completed: 8
};

function makeStatus(id) {
    const complete = id & TestState.completed;

    if (id & TestState.failed) {
        return complete ? "Failure" : "Failing";
    }
    else if (id & TestState.succeeded) {
        return complete ? "Success" : "Succeeding";
    }
    else if (id & TestState.started) {
        return complete ? "No test ran" : "Running";
    }
    else {
        return "Found";
    }
}

class TestScore {
    constructor(name) {
        this.name = name;
        this.state = TestState.found;
        this.messages = [];
    }

    start() {
        this.state |= TestState.started;
    }

    success(message) {
        this.state |= TestState.succeeded;
        this.messages.push(message);
    }

    fail(message) {
        this.state |= TestState.failed;
        this.messages.push(message);
    }

    finish(value) {
        this.state |= TestState.completed;
        if (!!value) {
            this.messages.push(value);
        }
    }
}

class TestRunnerResultsEvent extends Event {
    constructor(results) {
        super("testrunnerresults");
        this.results = results;
    }
}

class TestRunner extends EventTarget {
    constructor(...CaseClasses) {
        super();
        this.CaseClasses = CaseClasses;
    }

    async run(testCaseName, testName) {

        const results = {};
        const onUpdate = () => this.dispatchEvent(new TestRunnerResultsEvent(results));

        for (let CaseClass of this.CaseClasses) {
            results[CaseClass.name] = {};
            for (let name of this.testNames(CaseClass.prototype)) {
                if (this.isTest(CaseClass.prototype, name)) {
                    results[CaseClass.name][name] = new TestScore(name);
                    onUpdate();
                }
            }
        }

        const q = [];
        for (let CaseClass of this.CaseClasses) {
            const className = CaseClass.name;
            if (className === testCaseName
                || testCaseName === undefined
                || testCaseName === null) {
                for (let funcName of this.testNames(CaseClass.prototype)) {
                    if (this.isTest(CaseClass.prototype, funcName, testName)) {
                        q.push(this.runTest.bind(this, CaseClass, funcName, results, className, onUpdate));
                    }
                }
            }
        }

        const update = () => {
            if (q.length > 0) {
                const test = q.shift();
                test()
                    .then(restart)
                    .catch(restart);
            }
        },
            restart = () => setTimeout(update, 0);
        restart();
    }

    async runTest(CaseClass, funcName, results, className, onUpdate) {
        const testCase = new CaseClass(),
            func = testCase[funcName],
            score = results[className][funcName],
            onMessage = (evt) => {
                score.messages.push(evt.message);
                onUpdate();
            },
            onSuccess = (evt) => {
                score.success(evt.message);
                onUpdate();
            },
            onFailure = (evt) => {
                score.fail(evt.message);
                onUpdate();
            };
        testCase.addEventListener("testcasemessage", onMessage);
        testCase.addEventListener("testcasesuccess", onSuccess);
        testCase.addEventListener("testcasefail", onFailure);
        let message = null;
        try {
            score.start();
            onUpdate();
            testCase.setup();
            message = func.call(testCase);
            if (message instanceof Promise) {
                message = await message;
            }
        }
        catch (error) {
            message = error;
            onFailure({ message: error });
        }
        score.finish(message);
        onUpdate();
        testCase.teardown();
        testCase.removeEventListener("testcasefail", onFailure);
        testCase.removeEventListener("testcasesuccess", onSuccess);
        testCase.removeEventListener("testcasemessage", onMessage);
        onUpdate();
    }

    isTest(testCase, name, testName) {
        return (name === testName
            || ((testName === undefined || testName === null)
                && name.startsWith("test_")))
            && testCase[name] instanceof Function;
    }

    testNames(TestClass) {
        const names = Object.getOwnPropertyNames(TestClass);
        names.sort();
        return names;
    }
}

class TestCaseMessageEvent extends Event {
    constructor(message) {
        super("testcasemessage");
        this.message = message;
    }
}

class TestCaseSuccessEvent extends Event {
    constructor(message) {
        super("testcasesuccess");
        this.message = message;
    }
}

class TestCaseFailEvent extends Event {
    constructor(message) {
        super("testcasefail");
        this.message = message;
    }
}

export class TestCase extends EventTarget {
    setup() { }
    teardown() { }

    message(msg) {
        msg = msg || "N/A";
        this.dispatchEvent(new TestCaseMessageEvent(msg));
    }

    success(msg) {
        msg = msg || "Success";
        this.dispatchEvent(new TestCaseSuccessEvent(msg));
    }

    fail(msg) {
        msg = msg || "Fail";
        this.dispatchEvent(new TestCaseFailEvent(msg));
    }

    isEqualTo(actual, expected, message) {
        this._twoValueTest(actual, "===", expected, (a, b) => a === b, message);
    }

    isNull(value, message) {
        this.isEqualTo(value, null, message);
    }

    isNotNull(value, message) {
        this.isNotEqualTo(value, null, message);
    }

    isUndefined(value, message) {
        this.isEqualTo(value, undefined, message);
    }

    isNotUndefined(value, message) {
        this.isNotEqualTo(value, undefined, message);
    }

    isTrue(value, message) {
        this.isEqualTo(value, true, message);
    }

    isFalse(value, message) {
        this.isEqualTo(value, false, message);
    }

    isBoolean(value, message) {
        this.isEqualTo(value === true || value === false, true, message);
    }

    hasValue(value, message) {
        message = message || `${value} is a value`;
        const badMessage = message || `${value} is not a value`,
            isValue = value !== null && value !== undefined;
        this.isTrue(isValue, isValue ? message : badMessage);
    }

    isEmpty(value, message) {
        message = message || `${value} is empty`;
        this.isEqualTo(value.length, 0, message);
    }

    isNotEqualTo(actual, expected, message) {
        this._twoValueTest(actual, "!==", expected, (a, b) => a !== b, message);
    }

    isLessThan(actual, expected, message) {
        this._twoValueTest(actual, "<", expected, (a, b) => a < b, message);
    }

    isLessThanEqual(actual, expected, message) {
        this._twoValueTest(actual, "<=", expected, (a, b) => a <= b, message);
    }

    isGreaterThan(actual, expected, message) {
        this._twoValueTest(actual, ">", expected, (a, b) => a > b, message);
    }

    isGreaterThanEqual(actual, expected, message) {
        this._twoValueTest(actual, ">=", expected, (a, b) => a >= b, message);
    }

    throws(func, message) {
        this._throwTest(func, true, message);
    }

    doesNotThrow(func, message) {
        this._throwTest(func, false, message);
    }


    _twoValueTest(actual, op, expected, testFunc, message) {
        const testValue = testFunc(actual, expected),
            testString = testValue ? "yes" : "no";

        message = message || `[Actual: ${actual}] ${op} [Expected: ${expected}] (${testString})`;

        if (testValue) {
            this.success(message);
        }
        else {
            this.fail(message);
        }
    }

    _throwTest(func, op, message) {
        let threw = false;
        try {
            func();
        }
        catch (exp) {
            threw = true;
        }

        const testValue = threw === op,
            testString = testValue ? "Success!" : "Fail!",
            testMessage = `Expected function to ${op} -> ${testString}`;

        message = ((message && message + ". ") || "") + testMessage;

        if (testValue) {
            this.success(message);
        }
        else {
            this.fail(message);
        }
    }
}