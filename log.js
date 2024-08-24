const fs = require("fs");
const moment = require("moment");
const path = require('path');

async function logAction(username, text, description, config) {
    if (!config.log_activities) {
        return
    }
    const date = new Date();
    const logPath = path.join(process.cwd(), "logs", username, `${moment(date).format("Do MMMM YYYY")}.txt`)

    try {
        const dir = path.dirname(logPath);

        await fs.promises.mkdir(dir, { recursive: true });

        if (description !== null) {
            await fs.promises.appendFile(logPath, `[${moment(date).format("HH:mm:ss")}] ${username}: \n|\t${text} \n|\t ${description}\n\n`, 'utf8');
        } else {
            await fs.promises.appendFile(logPath, `[${moment(date).format("HH:mm:ss")}] ${username}: ${text} \n\n`, 'utf8');
        }
    } catch (err) {
        console.error(err);
    }
}

function logFileWriting(filePath, updateTimerFunc, account, config) {
    updateTimerFunc(timer => {
        if (timer !== null) {
            clearTimeout(timer);

            timer = setTimeout(() => {
                // console.log("Stopped writing!");
                logAction(account.name, `Stopped Writing File (${path.basename(filePath)}) before 10 seconds`, filePath, config);

                updateTimerFunc(() => { return null })
            }, 10000);
        } else {
            // console.log("Started writing");

            logAction(account.name, `Started Writing File (${path.basename(filePath)})`, filePath, config);

            timer = setTimeout(() => {
                logAction(account.name, `Write (${path.basename(filePath)})`, filePath, config);
            }, 10000);
        }

        return timer

    });
}

module.exports = { logAction, logFileWriting }