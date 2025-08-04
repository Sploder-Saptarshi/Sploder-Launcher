
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
    } catch (error) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
    }
}


function main() {
    console.log('URL must be exactly in this format: https://www.sploder.net');
    console.log('Make sure to include the protocol (http:// or https://) and do not include a trailing slash.\n');
    rl.question('Please enter the URL the launcher should open: ', (userUrl) => {
        if (!userUrl) {
            console.log('No URL provided. Exiting.');
            rl.close();
            return;
        }

        console.log(`\nStarting replacement process for files in: ${sourceDirectory}`);
        console.log(`Replacing '_[[URL]]_' with: '${userUrl}'\n`);

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
                console.log('\nReplacement process completed.');
            }
        } catch (error) {
            console.error(`An error occurred: ${error.message}`);
            if (error.code === 'ENOENT') {
                console.error(`Please ensure the directory '${sourceDirectory}' exists.`);
            }
        } finally {
            rl.close();
        }
    });
}


main();
