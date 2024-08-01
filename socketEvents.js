const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const colors = require("colors");
const {extractFiles, getRemainingFolderSpace} = require("./utils");

module.exports = function (io, config) {
    io.on('connection', (socket) => {

        socket.join(socket.id);

        console.log('User connected!'.green);

        socket.on('disconnect', () => {
            console.log('User disconnected!'.red);
        });

        socket.on('unzip', (res) => {
            if (res.password === config.password) {
                let totalUncompressedSize = 0;
                let limit = getRemainingFolderSpace(config);
                let zipFilePath = `${config.folder}${res.path}`;
                let nameOfOutputDir = path.basename(`${config.folder}${res.path}`, ".zip");
                let changedNameOfOutputDir = path.basename(`${config.folder}${res.path}`, ".zip");
                let outputDir = `${config.folder}/${nameOfOutputDir}`;
                let i = 0;
                if (!fs.existsSync(zipFilePath)) {
                    io.to(socket.id).emit("error", {err: "Zip file is not existing"})
                    return
                }
                while (fs.existsSync(outputDir)) {
                    i++;
                    changedNameOfOutputDir = `${nameOfOutputDir} (${i})`
                    outputDir = `${config.folder}/${changedNameOfOutputDir}`;
                }

                yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
                    if (err) {
                        io.to(socket.id).emit("error", {err: "Unknown error!"})
                    }
                  
                    zipfile.readEntry();
                  
                    zipfile.on('entry', (entry) => {
                      totalUncompressedSize += entry.uncompressedSize;
                      if (totalUncompressedSize > limit) {
                        console.log("Limit exceed!");
                        io.to(socket.id).emit("error", {err: "Not enough space!"})
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
                console.log("Wrong password!");
                io.to(socket.id).emit("error", {err: "Password is missing!"})
                return
            }
        });
    });
};
