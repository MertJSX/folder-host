const fs = require("fs")
const path = require("path")
const {DirItem} = require("./dir_item");

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


const getDirItems = function (dirPath, mode, config) {
  let files = fs.readdirSync(dirPath, { withFileTypes: true })

  let arrayOfItems = []

  files.forEach(function (file) {
    let fileStats = fs.statSync(dirPath + "/" + file.name);
    let isDirectory = fileStats.isDirectory();
    let size = fileStats.size;
    let parentPath;

    if (mode === "Quality mode" && isDirectory) {
      size = getTotalSize(dirPath+ file.name);
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
    item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, size)
    : item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, convertBytes(size) );


    arrayOfItems.push(item)
  })

  return arrayOfItems
}

const getTotalSize = function (directoryPath) {
  const arrayOfFiles = getAllFiles(directoryPath)

  //console.log(arrayOfFiles);

  let totalSize = 0

  arrayOfFiles.forEach(function (filePath) {
    totalSize += fs.statSync(filePath).size
  })

  // console.log(directoryPath);
  // console.log(totalSize);
  // console.log(convertBytes(totalSize));

  return convertBytes(totalSize);
}



module.exports = { getTotalSize, getDirItems, getParent, replacePathPrefix, removeDir };