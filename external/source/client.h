#ifndef INCLUDED_MQTT_CLIENT
#define INCLUDED_MQTT_CLIENT

#include <thread>
#include <atomic>

#include "mqtt_utils.h"


class Client
{
	MQTT::unique_mosquitto mosquitto;

	std::thread client_thread;

	std::atomic<bool> on = true;

	static void on_connect(struct mosquitto*, void*, int);
	static void on_disconnect(struct mosquitto*, void*, int);
	static void on_subscribe(struct mosquitto*, void*, int, int, const int*);
	static void on_publish(struct mosquitto*, void*, int);
	static void on_message(struct mosquitto*, void*, const struct mosquitto_message*);
	static void on_log(struct mosquitto*, void*, int, const char*);

public:
	Client(const char* host, int port, const char* uuid, const char* topic, int keepalive = 60);
	~Client();
};

#endif
