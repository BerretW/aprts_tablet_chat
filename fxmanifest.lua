fx_version 'cerulean'
lua54 'yes'

name 'aprts_tablet_chat'
description 'Chat App with Rooms'
author 'SpoiledMouse'
version '1.0.0'
games {"gta5"}
shared_scripts { '@ox_lib/init.lua' }
client_scripts { 'client.lua' }
server_scripts { 'server.lua' }

files {
    'install.sql',
    'web/index.html',
    'web/style.css',
    'web/script.js',
    'web/images/*.png'
}

dependencies { 'aprts_tablet', 'oxmysql' }