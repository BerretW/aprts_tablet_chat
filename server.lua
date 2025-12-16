local APP_ID = 'chat'

-- 1. Načtení seznamu místností
lib.callback.register('aprts_chat:server:getRooms', function(source)
    -- Vracíme i 'created_by', abychom poznali majitele
    return exports.oxmysql:executeSync('SELECT * FROM aprts_chat_rooms ORDER BY id ASC')
end)

lib.callback.register('aprts_chat:server:getMessages', function(source, roomId)
    local msgs = exports.oxmysql:executeSync('SELECT * FROM aprts_chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50', {roomId})
    table.sort(msgs, function(a, b) return a.id < b.id end)
    return msgs
end)

lib.callback.register('aprts_chat:server:getUser', function(source, serial)
    local user = exports.oxmysql:singleSync('SELECT username FROM aprts_chat_users WHERE serial = ?', {serial})
    return user and user.username or nil
end)

RegisterNetEvent('aprts_chat:server:registerUser', function(serial, username)
    if not username or string.len(username) < 3 then return end
    exports.oxmysql:executeSync('INSERT INTO aprts_chat_users (serial, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = ?', {
        serial, username, username
    })
end)

-- UPRAVENO: Ukládáme SERIAL majitele
RegisterNetEvent('aprts_chat:server:createRoom', function(roomName, ownerSerial)
    local id = exports.oxmysql:insertSync('INSERT INTO aprts_chat_rooms (name, created_by) VALUES (?, ?)', {
        roomName, ownerSerial
    })
    -- Pošleme info všem, včetně Serialu majitele
    TriggerClientEvent('aprts_chat:client:roomCreated', -1, {id = id, name = roomName, created_by = ownerSerial})
end)

-- NOVÉ: Mazání místnosti
RegisterNetEvent('aprts_chat:server:deleteRoom', function(roomId, requestorSerial)
    -- 1. Ověříme, zda je žadatel skutečně majitelem
    local room = exports.oxmysql:singleSync('SELECT created_by FROM aprts_chat_rooms WHERE id = ?', {roomId})
    
    if room and room.created_by == requestorSerial then
        -- 2. Smažeme místnost
        exports.oxmysql:executeSync('DELETE FROM aprts_chat_rooms WHERE id = ?', {roomId})
        -- 3. Smažeme zprávy v místnosti (úklid)
        exports.oxmysql:executeSync('DELETE FROM aprts_chat_messages WHERE room_id = ?', {roomId})
        
        -- 4. Oznámíme klientům, ať si ji smažou z UI
        TriggerClientEvent('aprts_chat:client:roomDeleted', -1, roomId)
    else
        print("^1[Chat] Pokus o smazání cizí místnosti od: " .. tostring(requestorSerial) .. "^0")
    end
end)

RegisterNetEvent('aprts_chat:server:sendMessage', function(data)
    if not data.message or data.message == '' then return end

    local dbUser = exports.oxmysql:singleSync('SELECT username FROM aprts_chat_users WHERE serial = ?', {data.serial})
    local finalName = dbUser and dbUser.username or data.senderName

    local insertId = exports.oxmysql:insertSync('INSERT INTO aprts_chat_messages (room_id, sender_serial, sender_name, message) VALUES (?, ?, ?, ?)', {
        data.roomId, data.serial, finalName, data.message
    })

    local broadcastData = {
        id = insertId,
        room_id = data.roomId,
        sender_serial = data.serial,
        sender_name = finalName,
        message = data.message,
        created_at = os.date('%H:%M') 
    }

    TriggerClientEvent('aprts_chat:client:receiveMessage', -1, broadcastData)
end)