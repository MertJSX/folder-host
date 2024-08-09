const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const colors = require("colors");
const chokidar = require('chokidar');
const { extractFiles, getRemainingFolderSpace } = require("./utils");
const watchers = new Map();

module.exports = function (io, config) {
    io.on('connection', (socket) => {
        let account = config.accounts
            .find((account) => { return account.name === socket.handshake.auth.username })

        socket.join(socket.id);

        console.log('User connected!'.green);

        const currentWatchPath = socket.handshake.auth.watch;
        const watchFile = `${config.folder}${currentWatchPath}`;

        if (socket.handshake.auth.watch && account.permissions.read_files) {
            const watcher = chokidar.watch(watchFile, {
                persistent: true,
            });

            watcher.on('change', (path) => {
                let fileContent = "";
                fs.readFile(watchFile, "utf8", (err, data) => {
                    if (err) {
                        console.log(err);
                        return
                    } else {
                        fileContent = data
                        socket.emit('file-changed', { path: currentWatchPath, fileContent: fileContent });
                    }
                });
            });

            watchers.set(socket.id, watcher);
        }

        socket.on('disconnect', () => {
            console.log('User disconnected!'.red);
            const watcher = watchers.get(socket.id);
            if (watcher) {
                watcher.close();
                watchers.delete(socket.id);
                // console.log(`Stopped watching file for client ${socket.id}`);
            }
        });

        socket.on('change-file', (res) => {
            if (!account.permissions.change) {

                io.to(socket.id).emit("error", {
                    err: "No permission!"
                })

                return
            }
            if (fs.existsSync(`${config.folder}${res.path}`)) {
                fs.writeFileSync(watchFile, res.content);
            }
        });

        socket.on('unzip', (res) => {
            if (account.permissions.unzip) {
                let totalUncompressedSize = 0;
                let limit = getRemainingFolderSpace(config);
                let zipFilePath = `${config.folder}${res.path}`;
                let nameOfOutputDir = path.basename(`${config.folder}${res.path}`, ".zip");
                let changedNameOfOutputDir = path.basename(`${config.folder}${res.path}`, ".zip");
                let outputDir = `${config.folder}/${nameOfOutputDir}`;
                let i = 0;
                if (!fs.existsSync(zipFilePath)) {
                    io.to(socket.id).emit("error", { err: "Zip file is not existing" })
                    return
                }
                while (fs.existsSync(outputDir)) {
                    i++;
                    changedNameOfOutputDir = `${nameOfOutputDir} (${i})`
                    outputDir = `${config.folder}/${changedNameOfOutputDir}`;
                }

                yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
                    if (err) {
                        io.to(socket.id).emit("error", { err: "Unknown error!" })
                    }

                    zipfile.readEntry();

                    zipfile.on('entry', (entry) => {
                        totalUncompressedSize += entry.uncompressedSize;
                        if (totalUncompressedSize > limit) {
                            console.log("Limit exceed!");
                            io.to(socket.id).emit("error", { err: "Not enough space!" })
                            return
                        }
                        zipfile.readEntry();
                    });

                    zipfile.on('end', () => {
                        console.log("End");
                        extractFiles(zipFilePath, outputDir, totalUncompressedSize, socket, io);
                    });

                    zipfile.on('error', (err) => {
                        console.error('An error occurred:', err);
                    });
                });
            } else {
                io.to(socket.id).emit("error", { err: "No permission!" })
                return
            }
        });
    });
};
