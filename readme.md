# Sploder Launcher

A repository that aims to provide a standalone application to be able to access the Sploder-Revival project without needing to install Flash or downgraded applications system wide.

Join the [Discord Server](https://discord.gg/cHGz362sdC) for the active community and development.

## Using without releases

- Download the [latest release](https://github.com/Sploder-Saptarshi/Sploder-Launcher/releases/latest)
- Run the installer

## How to build

### Dependencies

 - [node.js](https://nodejs.org/en)
 - [node version manager (nvm)](https://github.com/nvm-sh/nvm)

### Steps to Build

 - Run `nvm use` to switch to the node version specified in .nvmrc
 - Run `npm i` to install all necessary packages
 - Run `npm run dist` to build the project
 - The built files will be available in the dist folder.

### Steps to Debug

 - Run `nvm use` to switch to the node version specified in .nvmrc
 - Run `npm i` to install all necessary packages
 - Run `npm run dev` to start the electron development server
