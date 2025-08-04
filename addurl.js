const fs = require('fs');
const path = require('path');
const readline = require('readline');


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});



const sourceDirectory = path.join(__dirname, 'src');


function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {

            getAllFiles(filePath, fileList);
        } else {

            fileList.push(filePath);
        }
    });
    return fileList;
}


function replaceInFile(filePath, oldString, newUrl) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;


        const regex = new RegExp(oldString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        content = content.replace(regex, newUrl);

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
        }
    } catch (error) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
    }
}


function isValidUrl(url) {
    const protocolRegex = /^(http|https):\/\//;
    const trailingSlashRegex = /\/$/;
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!protocolRegex.test(url)) {
        console.error('Error: URL must begin with http:// or https://');
        return false;
    }

    if (trailingSlashRegex.test(url)) {
        console.error('Error: URL must not have a trailing slash.');
        return false;
    }

    const domain = url.split('//')[1];
    if (!domainRegex.test(domain)) {
        console.error('Error: URL must contain a proper domain format (e.g., domain.tld).');
        return false;
    }

    return true;
}


function processFiles(userUrl) {
    if (!isValidUrl(userUrl)) {
        rl.close();
        return;
    }

    try {

        const allFiles = getAllFiles(sourceDirectory);


        const targetFiles = allFiles.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.html' || ext === '.js';
        });

        if (targetFiles.length === 0) {
            console.log(`No .html or .js files found in '${sourceDirectory}'.`);
        } else {

            targetFiles.forEach(file => {
                replaceInFile(file, '_[[URL]]_', userUrl);
            });
            console.log('URL added successfully.');
        }
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        if (error.code === 'ENOENT') {
            console.error(`Please ensure the directory '${sourceDirectory}' exists.`);
        }
    } finally {
        rl.close();
    }
}


function main() {
    const args = process.argv.slice(2);
    const urlArgIndex = args.indexOf('--url');
    const greenColor = '\x1b[32m';
    const resetColor = '\x1b[0m';
    if (urlArgIndex !== -1 && args[urlArgIndex + 1]) {
        const userUrl = args[urlArgIndex + 1];
        processFiles(userUrl);
    } else {
        console.log(`URL must be exactly in this format: ${greenColor}https://www.sploder.net${resetColor}`);
        console.log('Make sure to include the protocol (http:// or https://) and do not include a trailing slash.\n');
        rl.question('Please enter the URL the launcher should open: ', (userUrl) => {
            if (!userUrl) {
                console.log('No URL provided. Exiting.');
                rl.close();
                return;
            }
            processFiles(userUrl);
        });
    }
}


main();