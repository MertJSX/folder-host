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

module.exports = {logAction}