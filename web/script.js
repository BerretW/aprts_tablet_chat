var ChatApp = {
  currentRoomId: null,
  mySerial: null,
  myName: null,
  allRooms: [], // Ukládáme si všechny místnosti pro vyhledávání

  // ==========================================================================
  // 1. INICIALIZACE A INPUTY
  // ==========================================================================
  init: function () {
    // Zkusíme najít klíčové prvky
    let serialEl = document.getElementById("my-serial");
    let regEl = document.getElementById("is-registered");
    let nameEl = document.getElementById("my-name");

    // Pokud HTML ještě není načtené, zkusíme to za chvíli znovu
    if (!serialEl || !regEl || !nameEl) {
      setTimeout(() => ChatApp.init(), 200);
      return;
    }

    // Načtení dat
    this.mySerial = serialEl.value;
    let isRegistered = regEl.value === "true";
    let storedName = nameEl.value;

    // Listener pro zprávy z Lua
    if (window.MyChatAppListener) {
      window.removeEventListener("message", window.MyChatAppListener);
    }

    // Uložíme si AKTUÁLNÍ funkci do globální proměnné, abychom ji příště našli
    window.MyChatAppListener = ChatApp.onMessage;

    // A přidáme ji jako listener
    window.addEventListener("message", window.MyChatAppListener);

    // Enter v chatu
    let chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") ChatApp.sendMessage();
      });
    }

    // Enter v registraci
    let regInput = document.getElementById("reg-username");
    if (regInput) {
      regInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") ChatApp.register();
      });
    }

    // Rozhodování: Registrace vs Chat
    if (isRegistered && storedName) {
      this.myName = storedName;
      this.showChatInterface();
    } else {
      let setupScreen = document.getElementById("setup-screen");
      let appRoot = document.getElementById("chat-app-root");

      if (setupScreen) setupScreen.style.display = "flex";
      if (appRoot) appRoot.style.display = "none";
    }
  },

  // ==========================================================================
  // 2. REGISTRACE
  // ==========================================================================
  register: function () {
    let input = document.getElementById("reg-username");
    let name = input.value.trim();

    if (name.length < 3) {
      input.style.borderColor = "#e74c3c"; // Červený rámeček při chybě
      return;
    }

    // Odeslání na server
    System.pluginAction("chat", "registerUser", {
      serial: this.mySerial,
      username: name,
    });

    // UI se přepne až přijde potvrzení 'chat_registered'
  },

  // ==========================================================================
  // 3. ZPRACOVÁNÍ DAT ZE SERVERU (Lua -> JS)
  // ==========================================================================
  onMessage: function (event) {
    let data = event.data;
    if (!data.action || !data.action.startsWith("chat_")) return;

    if (data.action === "chat_registered") {
      ChatApp.myName = data.username;
      ChatApp.showChatInterface();
    } else if (data.action === "chat_updateRooms") {
      ChatApp.allRooms = data.rooms;
      ChatApp.renderRooms(ChatApp.allRooms);
    } else if (data.action === "chat_updateMessages") {
      ChatApp.renderMessages(data.messages);
    } else if (data.action === "chat_newMessage") {
      ChatApp.appendMessage(data.message);
    } else if (data.action === "chat_newRoom") {
      ChatApp.allRooms.push(data.room);
      // Pokud máme něco ve vyhledávání, musíme znovu filtrovat
      ChatApp.searchRooms();
    } else if (data.action === "chat_removeRoom") {
      // Odstranění místnosti z pole
      ChatApp.allRooms = ChatApp.allRooms.filter((r) => r.id !== data.roomId);
      ChatApp.searchRooms(); // Překreslit seznam

      // Pokud jsme byli uvnitř smazané místnosti
      if (ChatApp.currentRoomId === data.roomId) {
        document.getElementById("msg-container").innerHTML =
          '<div style="opacity:0.5; text-align:center; margin-top:20px;">Tato místnost byla smazána.</div>';
        document.getElementById("current-room-name").innerText =
          "Místnost smazána";
        ChatApp.currentRoomId = null;
      }
    }
  },

  // ==========================================================================
  // 4. UI LOGIKA (Přepínání obrazovek)
  // ==========================================================================
  showChatInterface: function () {
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("chat-app-root").style.display = "flex";

    document.getElementById("display-username").innerText = this.myName;
    document.getElementById("display-serial").innerText =
      "ID: " + this.mySerial.slice(-4);

    // Načíst místnosti
    System.pluginAction("chat", "fetchRooms", {});
  },

  // ==========================================================================
  // 5. MÍSTNOSTI (Render, Search, Delete)
  // ==========================================================================
  searchRooms: function () {
    let query = document.getElementById("room-search").value.toLowerCase();
    let filtered = ChatApp.allRooms.filter((r) =>
      r.name.toLowerCase().includes(query)
    );
    ChatApp.renderRooms(filtered);
  },

  renderRooms: function (rooms) {
    let container = document.getElementById("rooms-container");
    container.innerHTML = "";

    rooms.forEach((r) => {
      let div = document.createElement("div");
      div.className = "room-item";
      div.dataset.id = r.id;

      // Zvýraznění aktivní místnosti
      if (ChatApp.currentRoomId === r.id) div.classList.add("active");

      // Tlačítko pro smazání (jen pro majitele)
      let deleteBtn = "";
      if (r.created_by && r.created_by === ChatApp.mySerial) {
        // event.stopPropagation() je důležité, aby kliknutí na koš neotevřelo roomku
        deleteBtn = `<i class="fas fa-trash-alt delete-room-btn" onclick="event.stopPropagation(); ChatApp.deleteRoom(${r.id})"></i>`;
      }

      div.innerHTML = `
                <div class="room-name-wrapper">${r.name}</div>
                ${deleteBtn}
            `;

      div.onclick = () => ChatApp.switchRoom(r.id, r.name);
      container.appendChild(div);
    });
  },

  switchRoom: function (id, name) {
    if (ChatApp.currentRoomId === id) return;

    ChatApp.currentRoomId = id;
    document.getElementById("current-room-name").innerText = name;

    // Aktualizace CSS třídy active
    document.querySelectorAll(".room-item").forEach((el) => {
      el.classList.remove("active");
      if (parseInt(el.dataset.id) === id) el.classList.add("active");
    });

    // Vyčištění chatu a načtení nových zpráv
    document.getElementById("msg-container").innerHTML =
      '<div style="opacity:0.5; text-align:center; margin-top:20px;">Načítání zpráv...</div>';
    System.pluginAction("chat", "fetchMessages", { roomId: id });
  },

  createRoomPrompt: function () {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Nová místnost",
        input: "text",
        background: "#36393f",
        color: "#fff",
        showCancelButton: true,
        confirmButtonText: "Vytvořit",
        cancelButtonText: "Zrušit",
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          System.pluginAction("chat", "createRoom", {
            name: result.value,
            serial: ChatApp.mySerial,
          });
        }
      });
    } else {
      let name = prompt("Název místnosti:");
      if (name)
        System.pluginAction("chat", "createRoom", {
          name: name,
          serial: ChatApp.mySerial,
        });
    }
  },

  deleteRoom: function (id) {
    // Potvrzení smazání
    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Smazat místnost?",
        text: "Tuto akci nelze vrátit.",
        icon: "warning",
        background: "#36393f",
        color: "#fff",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Smazat",
        cancelButtonText: "Zrušit",
      }).then((result) => {
        if (result.isConfirmed) {
          System.pluginAction("chat", "deleteRoom", {
            roomId: id,
            serial: ChatApp.mySerial,
          });
        }
      });
    } else {
      if (confirm("Opravdu smazat tuto místnost?")) {
        System.pluginAction("chat", "deleteRoom", {
          roomId: id,
          serial: ChatApp.mySerial,
        });
      }
    }
  },

  // ==========================================================================
  // 6. ZPRÁVY
  // ==========================================================================
  renderMessages: function (messages) {
    let container = document.getElementById("msg-container");
    container.innerHTML = "";

    if (messages.length === 0) {
      container.innerHTML =
        '<div style="opacity:0.5; text-align:center; margin-top:20px;">Zatím žádné zprávy.</div>';
    }

    messages.forEach((msg) => ChatApp.appendMessage(msg));
    ChatApp.scrollToBottom();
  },

  appendMessage: function (msg) {
    // Pokud zpráva nepatří do otevřené roomky, ignorujeme ji
    if (parseInt(msg.room_id) !== ChatApp.currentRoomId) return;

    let container = document.getElementById("msg-container");

    // Pokud tam visí hláška "Zatím žádné zprávy", smažeme ji
    if (container.querySelector('div[style*="text-align:center"]')) {
      container.innerHTML = "";
    }

    let isMe = msg.sender_serial === ChatApp.mySerial;
    let div = document.createElement("div");
    div.className = "message " + (isMe ? "self" : "");

    // Formátování času
    let time = msg.created_at || "";
    if (typeof time === "string" && time.length > 16)
      time = time.substring(11, 16);

    div.innerHTML = `
            <div class="msg-meta">
                <span class="msg-author">${msg.sender_name}</span>
                <span style="font-size:10px;">${time}</span>
            </div>
            <div class="msg-content">${ChatApp.escapeHtml(msg.message)}</div>
        `;

    container.appendChild(div);
    ChatApp.scrollToBottom();

    // Zvuk notifikace (pokud to nejsem já)
    if (!isMe && typeof System !== "undefined") System.playSound("notify");
  },

  sendMessage: function () {
    let input = document.getElementById("chat-input");
    let text = input.value.trim();

    if (!text || !ChatApp.currentRoomId) return;

    System.pluginAction("chat", "sendMessage", {
      roomId: ChatApp.currentRoomId,
      message: text,
      serial: ChatApp.mySerial,
      senderName: ChatApp.myName,
    });

    input.value = "";
    input.focus();
  },

  // ==========================================================================
  // 7. POMOCNÉ FUNKCE
  // ==========================================================================
  scrollToBottom: function () {
    let container = document.getElementById("msg-container");
    container.scrollTop = container.scrollHeight;
  },

  escapeHtml: function (text) {
    if (!text) return text;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
};

// Spuštění po krátké prodlevě pro jistotu načtení DOMu
setTimeout(() => ChatApp.init(), 250);
