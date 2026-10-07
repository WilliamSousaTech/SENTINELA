#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "DHT.h"

// =====================================================
// SENTINELA OS — ESP32 + Firebase
// =====================================================
// /sensores  = estado atual + heartbeat
// /historico = histórico das coletas
//
// ATENÇÃO:
// Preencha ssid e senha apenas no seu Arduino IDE local.
// Não publique credenciais reais no GitHub.
// =====================================================

// ---------------- PINOS ----------------
#define DHTPIN 23
#define DHTTYPE DHT11

#define PIRPIN 19
#define BUZZERPIN 18

#define LED_VERDE 25
#define LED_AMARELO 26
#define LED_VERMELHO 27

DHT dht(DHTPIN, DHTTYPE);

// ---------------- WI-FI ----------------
const char* ssid = "COLOQUE_SUA_REDE";
const char* senha = "COLOQUE_SUA_SENHA";

// ---------------- FIREBASE ----------------
const char* URL_SENSORES =
  "https://sentinela-a5028-default-rtdb.firebaseio.com/sensores.json?print=silent";

const char* URL_HISTORICO =
  "https://sentinela-a5028-default-rtdb.firebaseio.com/historico.json?print=silent";

// ---------------- INTERVALOS ----------------
const unsigned long INTERVALO_DHT = 2000;
const unsigned long INTERVALO_HISTORICO = 3000;
const unsigned long INTERVALO_HEARTBEAT = 3000;
const unsigned long INTERVALO_WIFI = 5000;

// ---------------- ESTADO ----------------
float temperatura = 0.0;
float umidade = 0.0;

int presencaAtual = 0;
int ultimaPresenca = -1;

String estadoAtual = "NORMAL";

unsigned long ultimoDHT = 0;
unsigned long ultimoHistorico = 0;
unsigned long ultimoHeartbeat = 0;
unsigned long ultimaTentativaWiFi = 0;

// ---------------- PIR ----------------
volatile bool pirEvento = false;

void IRAM_ATTR isrPIR() {
  pirEvento = true;
}

// ---------------- BUZZER ----------------
unsigned long ultimoBeep = 0;
bool buzzerLigado = false;

// =====================================================
// CLASSIFICAÇÃO
// =====================================================

String classificarAmbiente(float temp, float umid) {

  if (temp > 35.0 || umid < 30.0) {
    return "ALERTA";
  }

  if (
    (temp >= 32.0 && temp <= 35.0) ||
    (umid >= 30.0 && umid < 40.0)
  ) {
    return "ATENCAO";
  }

  return "NORMAL";
}

// =====================================================
// LEDS
// =====================================================

void atualizarLEDs() {

  digitalWrite(
    LED_VERDE,
    estadoAtual == "NORMAL" ? HIGH : LOW
  );

  digitalWrite(
    LED_AMARELO,
    estadoAtual == "ATENCAO" ? HIGH : LOW
  );

  digitalWrite(
    LED_VERMELHO,
    estadoAtual == "ALERTA" ? HIGH : LOW
  );
}

// =====================================================
// BUZZER NÃO BLOQUEANTE
// =====================================================

void atualizarBuzzer() {

  const unsigned long agora = millis();

  // NORMAL
  if (estadoAtual == "NORMAL") {

    digitalWrite(BUZZERPIN, LOW);
    buzzerLigado = false;

    return;
  }

  // ATENÇÃO
  if (estadoAtual == "ATENCAO") {

    if (!buzzerLigado) {

      if (agora - ultimoBeep >= 1000) {

        digitalWrite(BUZZERPIN, HIGH);
        buzzerLigado = true;
        ultimoBeep = agora;
      }
    }
    else {

      if (agora - ultimoBeep >= 150) {

        digitalWrite(BUZZERPIN, LOW);
        buzzerLigado = false;
        ultimoBeep = agora;
      }
    }

    return;
  }

  // ALERTA
  if (estadoAtual == "ALERTA") {

    if (agora - ultimoBeep >= 80) {

      ultimoBeep = agora;
      buzzerLigado = !buzzerLigado;

      digitalWrite(
        BUZZERPIN,
        buzzerLigado ? HIGH : LOW
      );
    }
  }
}

// =====================================================
// HTTP PATCH -> /SENSORES
// =====================================================

bool enviarSensores(
  bool enviarTemperatura,
  bool enviarUmidade,
  bool enviarPresenca,
  bool enviarEstado,
  bool enviarHeartbeat
) {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  String json = "{";
  bool primeiro = true;

  // Temperatura
  if (enviarTemperatura) {

    json += "\"temperatura\":";
    json += String(temperatura, 1);

    primeiro = false;
  }

  // Umidade
  if (enviarUmidade) {

    if (!primeiro) json += ",";

    json += "\"umidade\":";
    json += String(umidade, 1);

    primeiro = false;
  }

  // Presença
  if (enviarPresenca) {

    if (!primeiro) json += ",";

    json += "\"presenca\":";
    json += String(presencaAtual);

    primeiro = false;
  }

  // Estado
  if (enviarEstado) {

    if (!primeiro) json += ",";

    json += "\"estado\":\"";
    json += estadoAtual;
    json += "\"";

    primeiro = false;
  }

  // Heartbeat
  if (enviarHeartbeat) {

    if (!primeiro) json += ",";

    json += "\"ultimoContato\":";
    json += "{\".sv\":\"timestamp\"}";

    primeiro = false;
  }

  json += "}";

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, URL_SENSORES)) {

    Serial.println(
      "ERRO: nao foi possivel abrir /sensores"
    );

    return false;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  // IMPORTANTE:
  // ESP32 core 3.3.11 usa PATCH(String payload)
  int codigo = http.PATCH(json);

  Serial.print(
    "Firebase /sensores PATCH -> HTTP "
  );
  Serial.println(codigo);

  if (codigo > 0 && codigo != 200 && codigo != 204) {

    Serial.print(
      "Resposta/erro: "
    );

    Serial.println(
      http.errorToString(codigo)
    );
  }

  http.end();

  return (
    codigo == 200 ||
    codigo == 204
  );
}

// =====================================================
// POST -> /HISTORICO
// =====================================================

bool registrarHistorico() {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  String json = "{";

  json += "\"temperatura\":";
  json += String(temperatura, 1);

  json += ",\"umidade\":";
  json += String(umidade, 1);

  json += ",\"presenca\":";
  json += String(presencaAtual);

  json += ",\"estado\":\"";
  json += estadoAtual;
  json += "\"";

  // Timestamp real do Firebase.
  json += ",\"timestamp\":";
  json += "{\".sv\":\"timestamp\"}";

  json += "}";

  Serial.print(
    "Enviando historico: "
  );

  Serial.println(json);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, URL_HISTORICO)) {

    Serial.println(
      "ERRO: nao foi possivel abrir /historico"
    );

    return false;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  int codigo =
    http.POST(json);

  Serial.print(
    "Firebase /historico POST -> HTTP "
  );

  Serial.println(codigo);

  if (codigo > 0 && codigo != 200 && codigo != 201) {

    Serial.print(
      "Resposta/erro: "
    );

    Serial.println(
      http.errorToString(codigo)
    );
  }

  http.end();

  return (
    codigo == 200 ||
    codigo == 201
  );
}

// =====================================================
// PIR
// =====================================================

void processarPIR() {

  bool evento = false;

  noInterrupts();

  if (pirEvento) {

    pirEvento = false;
    evento = true;
  }

  interrupts();

  if (!evento) {
    return;
  }

  int novaPresenca =
    digitalRead(PIRPIN);

  if (novaPresenca ==
      ultimaPresenca) {
    return;
  }

  presencaAtual =
    novaPresenca;

  ultimaPresenca =
    novaPresenca;

  Serial.println();

  Serial.println(
    ">>> MUDANCA NO PIR <<<"
  );

  if (presencaAtual == HIGH) {

    Serial.println(
      ">>> MOVIMENTO DETECTADO <<<"
    );
  }
  else {

    Serial.println(
      ">>> MOVIMENTO ENCERRADO <<<"
    );
  }

  // Atualização imediata do site.
  enviarSensores(
    false,
    false,
    true,
    false,
    true
  );
}

// =====================================================
// DHT11
// =====================================================

void atualizarDHT() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoDHT <
    INTERVALO_DHT
  ) {
    return;
  }

  ultimoDHT =
    agora;

  float novaTemperatura =
    dht.readTemperature();

  float novaUmidade =
    dht.readHumidity();

  if (
    isnan(novaTemperatura) ||
    isnan(novaUmidade)
  ) {

    Serial.println();
    Serial.println(
      "ERRO AO LER DHT11!"
    );

    return;
  }

  temperatura =
    novaTemperatura;

  umidade =
    novaUmidade;

  String novoEstado =
    classificarAmbiente(
      temperatura,
      umidade
    );

  bool estadoMudou =
    novoEstado != estadoAtual;

  estadoAtual =
    novoEstado;

  atualizarLEDs();

  if (estadoMudou) {

    digitalWrite(
      BUZZERPIN,
      LOW
    );

    buzzerLigado = false;
    ultimoBeep = millis();
  }

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "          SENTINELA OS"
  );
  Serial.println(
    "================================"
  );

  Serial.print(
    "Temperatura: "
  );
  Serial.print(
    temperatura,
    1
  );
  Serial.println(
    " °C"
  );

  Serial.print(
    "Umidade: "
  );
  Serial.print(
    umidade,
    1
  );
  Serial.println(
    " %"
  );

  Serial.print(
    "Presenca: "
  );
  Serial.println(
    presencaAtual == HIGH
      ? "DETECTADO"
      : "VAZIO"
  );

  Serial.print(
    "Estado: "
  );
  Serial.println(
    estadoAtual
  );

  Serial.println(
    "================================"
  );

  // Atualiza painel atual.
  enviarSensores(
    true,
    true,
    true,
    true,
    true
  );
}

// =====================================================
// HISTÓRICO
// =====================================================

void verificarHistorico() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoHistorico <
    INTERVALO_HISTORICO
  ) {
    return;
  }

  ultimoHistorico =
    agora;

  registrarHistorico();
}

// =====================================================
// HEARTBEAT
// =====================================================

void verificarHeartbeat() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoHeartbeat <
    INTERVALO_HEARTBEAT
  ) {
    return;
  }

  ultimoHeartbeat =
    agora;

  // Atualiza SOMENTE o heartbeat.
  enviarSensores(
    false,
    false,
    false,
    false,
    true
  );
}

// =====================================================
// WIFI
// =====================================================

void verificarWiFi() {

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    return;
  }

  const unsigned long agora =
    millis();

  if (
    agora - ultimaTentativaWiFi <
    INTERVALO_WIFI
  ) {
    return;
  }

  ultimaTentativaWiFi =
    agora;

  Serial.println();
  Serial.println(
    "Wi-Fi desconectado."
  );
  Serial.println(
    "Tentando reconectar..."
  );

  WiFi.disconnect();
  WiFi.begin(
    ssid,
    senha
  );
}

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(
    115200
  );

  dht.begin();

  pinMode(
    PIRPIN,
    INPUT
  );

  pinMode(
    BUZZERPIN,
    OUTPUT
  );

  pinMode(
    LED_VERDE,
    OUTPUT
  );

  pinMode(
    LED_AMARELO,
    OUTPUT
  );

  pinMode(
    LED_VERMELHO,
    OUTPUT
  );

  digitalWrite(
    BUZZERPIN,
    LOW
  );

  digitalWrite(
    LED_VERDE,
    LOW
  );

  digitalWrite(
    LED_AMARELO,
    LOW
  );

  digitalWrite(
    LED_VERMELHO,
    LOW
  );

  // PIR sem bloqueio.
  attachInterrupt(
    digitalPinToInterrupt(PIRPIN),
    isrPIR,
    CHANGE
  );

  // Wi-Fi.
  WiFi.mode(
    WIFI_STA
  );

  WiFi.begin(
    ssid,
    senha
  );

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "       SENTINELA OS"
  );
  Serial.println(
    "================================"
  );

  Serial.print(
    "Conectando ao Wi-Fi"
  );

  while (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    delay(300);
    Serial.print(".");
  }

  Serial.println();
  Serial.println(
    "Wi-Fi conectado!"
  );

  Serial.print(
    "IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  // Estado inicial PIR.
  presencaAtual =
    digitalRead(PIRPIN);

  ultimaPresenca =
    presencaAtual;

  Serial.print(
    "PIR inicial: "
  );

  Serial.println(
    presencaAtual
  );

  // Primeira leitura do DHT.
  ultimoDHT =
    INTERVALO_DHT;

  // Primeiro heartbeat.
  enviarSensores(
    false,
    false,
    true,
    false,
    true
  );

  Serial.println();
  Serial.println(
    "SENTINELA iniciado."
  );
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  // PIR primeiro.
  processarPIR();

  // DHT.
  atualizarDHT();

  // Buzzer.
  atualizarBuzzer();

  // Histórico.
  verificarHistorico();

  // Heartbeat.
  verificarHeartbeat();

  // Wi-Fi.
  verificarWiFi();

  delay(2);
}
