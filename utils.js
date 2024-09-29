const fs = require("fs");
const path = require("path");
const yauzl = require('yauzl');
const { mkdirp } = require('mkdirp');
const { DirItem } = require("./dir_item");


const getAllFiles = async function (dirPath, arrayOfFiles) {
  let files = await fs.promises.readdir(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(async function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = await getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, file))
    }
  })

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

async function removeDir(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    const files = await fs.promises.readdir(directoryPath);

    for (const file of files) {
      const curPath = path.join(directoryPath, file);
      const stats = await fs.promises.lstat(curPath);

      if (stats.isDirectory()) {
        await removeDir(curPath);
      } else {
        await fs.promises.unlink(curPath);
      }
    }

    await fs.promises.rmdir(directoryPath);
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


const getDirItems = async function (dirPath, mode, config) {
  try {
    const data = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let arrayOfItems = [];

    for (const [index, file] of data.entries()) {
      let fileStats = fs.statSync(path.join(dirPath, file.name));
      let isDirectory = fileStats.isDirectory();
      let size = fileStats.size;
      let parentPath;

      if (mode === "Quality mode" && isDirectory) {
        size = await getTotalSize(path.join(dirPath, file.name));
      }

      if (file.parentPath === config.folder + "/") {
        parentPath = "./";
      } else {
        parentPath = replacePathPrefix(file.parentPath, `${config.folder}/`);
      }

      let item;
      mode === "Quality mode" && isDirectory ?
        item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, size, index)
        : item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, convertBytes(size), index);

      arrayOfItems.push(item);
    }

    return arrayOfItems;
  } catch (err) {
    console.error(err);
    return [];
  }
};

const getTotalSize = async function (directoryPath, stringOutput = true) {
  const getSize = async (filePath) => {
    const stats = await fs.promises.stat(filePath);

    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(filePath);
      const sizes = await Promise.all(files.map(file => getSize(path.join(filePath, file))));
      return sizes.reduce((acc, size) => acc + size, 0);
    } else {
      return stats.size;
    }
  };

  try {
    const totalSize = await getSize(directoryPath);

    if (stringOutput) {
      return convertBytes(totalSize);
    } else {
      return totalSize;
    }
  } catch (err) {
    console.error('Error calculating size:', err);
    throw err;
  }
};

const outputFolderSize = async (config) => {
  try {
    let folderSize = await getTotalSize(config.folder);

    if (config.storage_limit) {
      console.log("Total size: ".green, `${folderSize} / ${config.storage_limit}`);
    } else {
      console.log("Total size: ".green, folderSize);
    }
  } catch (err) {
    console.error(err);
  }
}

const getRemainingFolderSpace = async (config) => {
  let maxSize = convertStringToBytes(config.storage_limit);
  let folderSize = await getTotalSize(config.folder, false);
  let remainingSpace = maxSize - folderSize;
  return remainingSpace;
}

const checkSecurityIssue = async (req) => {
  if (req.query.folder) {
    if (req.query.folder.match(/\/\.\./)) {
      return true
    }
  }
  if (req.query.filepath) {
    if (req.query.filepath.match(/\/\.\./)) {
      return true
    }
  }
  if (req.query.path) {
    if (req.query.path.match(/\/\.\./)) {
      return true
    }
  }
  if (req.query.oldFilepath) {
    if (req.query.oldFilepath.match(/\/\.\./)) {
      return true
    }
  }
  if (req.query.newFilepath) {
    if (req.query.newFilepath.match(/\/\.\./)) {
      return true
    }
  }
  return false
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
  extractFiles,
  outputFolderSize,
  checkSecurityIssue
};