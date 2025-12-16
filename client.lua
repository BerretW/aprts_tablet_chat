local APP_ID = 'chat'
local APP_LABEL = 'Chat'

CreateThread(function()
    Wait(1000)
    exports['aprts_tablet']:RegisterApp(APP_ID, APP_LABEL, 'fas fa-comments', '#2ecc71', APP_ID..':open', nil, 30, 'all')
end)

local function LoadWebFile(fileName)
    return LoadResourceFile(GetCurrentResourceName(), 'web/' .. fileName)
end

RegisterNetEvent(APP_ID..':open', function(serial)
    -- 1. Wi-Fi Check
    local tabletData = exports['aprts_tablet']:GetTabletData()
    if not tabletData.wifi.isConnected then
        exports['aprts_tablet']:loadContent([[
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:white; text-align:center;">
                <i class="fas fa-wifi" style="font-size:50px; margin-bottom:20px; color:#ff7675;"></i>
                <h2>Žádné připojení</h2>
                <p>Chat vyžaduje aktivní Wi-Fi nebo SIM.</p>
            </div>
        ]])
        return
    end

    -- 2. Zjistíme, jestli je uživatel registrován
    local username = lib.callback.await('aprts_chat:server:getUser', false, serial)
    
    -- 3. Načteme HTML
    local html = LoadWebFile('index.html')
    if not html then return end

    -- 4. Injekce dat
    html = html:gsub('{{SERIAL}}', serial)
    
    -- Pokud username existuje, vložíme ho. Pokud ne, vložíme prázdný string (JS to pozná)
    if username then
        html = html:gsub('{{USERNAME}}', username)
        html = html:gsub('{{IS_REGISTERED}}', 'true')
    else
        html = html:gsub('{{USERNAME}}', '')
        html = html:gsub('{{IS_REGISTERED}}', 'false')
    end

    TriggerEvent('aprts_tablet:loadContent', html)
end)

RegisterNetEvent(APP_ID..':handleAction', function(action, data)
    if action == 'registerUser' then
        TriggerServerEvent('aprts_chat:server:registerUser', data.serial, data.username)
        exports['aprts_tablet']:SendNui({ action = "chat_registered", username = data.username })

    elseif action == 'fetchRooms' then
        local rooms = lib.callback.await('aprts_chat:server:getRooms', false)
        exports['aprts_tablet']:SendNui({ action = "chat_updateRooms", rooms = rooms })

    elseif action == 'fetchMessages' then
        local msgs = lib.callback.await('aprts_chat:server:getMessages', false, data.roomId)
        exports['aprts_tablet']:SendNui({ action = "chat_updateMessages", messages = msgs })

    elseif action == 'sendMessage' then
        TriggerServerEvent('aprts_chat:server:sendMessage', data)

    elseif action == 'createRoom' then
        -- UPRAVENO: Posíláme i serial majitele
        TriggerServerEvent('aprts_chat:server:createRoom', data.name, data.serial)

    elseif action == 'deleteRoom' then
        -- NOVÉ: Požadavek na smazání
        TriggerServerEvent('aprts_chat:server:deleteRoom', data.roomId, data.serial)
    end
end)

RegisterNetEvent('aprts_chat:client:receiveMessage', function(msgData)
    exports['aprts_tablet']:SendNui({ action = "chat_newMessage", message = msgData })
end)

RegisterNetEvent('aprts_chat:client:roomCreated', function(roomData)
    exports['aprts_tablet']:SendNui({ action = "chat_newRoom", room = roomData })
end)

-- NOVÉ: Event pro smazání z UI
RegisterNetEvent('aprts_chat:client:roomDeleted', function(roomId)
    exports['aprts_tablet']:SendNui({ action = "chat_removeRoom", roomId = roomId })
end)