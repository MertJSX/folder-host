const fs = require("fs");
const path = require("path");
const yauzl = require('yauzl');
const { mkdirp } = require('mkdirp');
const { DirItem } = require("./dir_item");
const fastFolderSizeSync = require('fast-folder-size/sync');

const getAllFiles = function (dirPath, arrayOfFiles) {
  let files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, file))
    }
  })

  // arrayOfFiles.forEach(function(filePath) {
  //     totalSize += fs.statSync(filePath).size
  // })

  return arrayOfFiles
}


const convertBytes = function (bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  if (bytes == 0) {
    return "N/A"
  }

  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))

  if (i == 0) {
    return bytes + " " + sizes[i]
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i]
}

const convertStringToBytes = function (sizeString) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const [value, unit] = sizeString.split(" ");

  const index = sizes.indexOf(unit);

  if (index === -1 || isNaN(value)) {
    return 0;
  }

  return parseFloat(value) * Math.pow(1024, index);
}

function getStringSize(str) {
  return new Blob([str]).size;
}

function removeDir(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

function replacePathPrefix(fullPath, realPrefix) {
  if (fullPath.startsWith(realPrefix)) {
    return "./" + fullPath.slice(realPrefix.length);
  }
  return fullPath;
}

function getParent(filePath) {
  let lastIndex = filePath.lastIndexOf('/');
  if (lastIndex === -1) return filePath;

  let item = filePath.slice(0, lastIndex);

  if (item.length > 1) {
    return item;
  } else {
    return filePath.slice(0, lastIndex + 1);
  }
}

function extractFiles(zipFilePath, outputDir, totalUncompressedSize, socket, io) {
  let extractedBytes = 0;
  let lastPercentage = 0;

  yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
    if (err) {
      console.log("Unknown error.");
      throw err
    };

    zipfile.readEntry();

    zipfile.on('entry', (entry) => {
      const fullPath = path.join(outputDir, entry.fileName);

      if (/\/$/.test(entry.fileName)) {
        mkdirp(fullPath).then(() => {
          zipfile.readEntry();
        }).catch((err) => {
          if (socket) {
            io.to(socket.id).emit({
              err: "Unknown error while unzipping!"
            })
          }
          console.error('An error occurred while ensuring directory exists:', err);
          return
        });
      } else {
        // Dosya
        mkdirp(path.dirname(fullPath)).then(() => {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) throw err;

            readStream.on('data', (chunk) => {
              extractedBytes += chunk.length;
              if (socket) {
                const percentage = Math.floor((extractedBytes / totalUncompressedSize) * 100);
                if (percentage > lastPercentage) {
                  let = lastPercentage = percentage;
                  console.log(`Progress: ${percentage}%`);
                  io.to(socket.id).emit("unzip-progress", {
                    progress: percentage
                  })
                }
              }

            });

            readStream.on('end', () => {
              zipfile.readEntry();
            });

            readStream.pipe(fs.createWriteStream(fullPath));
          });
        }).catch((err) => {
          console.log("We can't extract zip files with passwords.");
          console.error('An error occurred while ensuring directory exists:', err);
          zipfile.readEntry();
        });
      }
    });

    zipfile.on('end', () => {
      console.log('Extraction completed.');
      io.to(socket.id).emit("unzip-completed", {
        message: "Successfully completed!"
      })
    });

    zipfile.on('error', (err) => {
      io.to(socket.id).emit("error", {
        err: "Unknown error!"
      })
      console.error('An error occurred:', err);
    });
  });
}


const getDirItems = function (dirPath, mode, config) {
  let files = fs.readdirSync(dirPath, { withFileTypes: true })

  let arrayOfItems = []

  files.forEach(function (file, index) {
    let fileStats = fs.statSync(dirPath + "/" + file.name);
    let isDirectory = fileStats.isDirectory();
    let size = fileStats.size;
    let parentPath;

    if (mode === "Quality mode" && isDirectory) {
      size = getTotalSize(dirPath + file.name);
    }

    if (file.parentPath === config.folder + "/") {
      // console.log(`${file.parentPath} === ${config.folder}`);
      parentPath = "./";
    } else {
      // console.log(`${file.parentPath} === ${config.folder}`);
      parentPath = replacePathPrefix(file.parentPath, `${config.folder}/`);
    }

    let item;

    mode === "Quality mode" && isDirectory ?
      item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, size, index)
      : item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, convertBytes(size), index);


    arrayOfItems.push(item)
  })

  return arrayOfItems
}

const getTotalSize = function (directoryPath, stringOutput = true) {

  const totalSize = fastFolderSizeSync(directoryPath)

  if (stringOutput) {
    return convertBytes(totalSize);
  } else {
    return totalSize;
  }
}

const getRemainingFolderSpace = (config) => {
  let maxSize = convertStringToBytes(config.storage_limit);
  let folderSize = getTotalSize(config.folder, false);
  let remainingSpace = maxSize - folderSize;
  return remainingSpace;
}



module.exports = {
  getTotalSize,
  getDirItems,
  getParent,
  replacePathPrefix,
  removeDir,
  convertStringToBytes,
  getStringSize,
  getRemainingFolderSpace,
  convertBytes,
  extractFiles
};