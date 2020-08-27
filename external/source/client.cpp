#include <utility>
#include <string>
#include <string_view>
#include <iostream>

#include "client.h"

namespace
{
	template <typename... Args>
	std::ostream& log(Args&&... args)
	{
		std::cout << "MQTT: ";
		(std::cout << ... << std::forward<Args>(args));
		return std::cout << std::endl;
	}
}

Client::Client(const char* host, int port, const char* uuid, const char* topic, int keepalive)
	: mosquitto(MQTT::create_mosquitto(uuid, true, this))
{
	MQTT::throw_error(mosquitto_username_pw_set(
		mosquitto.get(),
		"horme",
		"hormeadmin"
	));
	MQTT::throw_error(mosquitto_connect(mosquitto.get(), host, port, keepalive));

	mosquitto_connect_callback_set(mosquitto.get(), &on_connect);
	mosquitto_subscribe_callback_set(mosquitto.get(), &on_subscribe);
	mosquitto_message_callback_set(mosquitto.get(), &on_message);
	mosquitto_publish_callback_set(mosquitto.get(), &on_publish);
	mosquitto_log_callback_set(mosquitto.get(), &on_log);
	mosquitto_disconnect_callback_set(mosquitto.get(), &on_disconnect);

	MQTT::throw_error(mosquitto_subscribe(mosquitto.get(), nullptr, topic, 0));

	client_thread = std::thread([mosquitto = mosquitto.get(), topic = std::string(topic), &on = on]
		{
			//mosquitto_loop_forever(mosquitto, -1, 1);

			bool peekaboo = true;

			while (mosquitto_loop(mosquitto, -1, 1) == MOSQ_ERR_SUCCESS)
			{
				using namespace std::literals;

				std::this_thread::sleep_for(5s);

				if (on.load(std::memory_order_relaxed))
				{
					auto payload = peekaboo ?
						R"""({
	"uuid": "cam",
	"type": "camera-motion-detect",
	"state": "on"
})"""sv :
	R"""({
	"uuid": "cam",
	"type": "camera-motion-detect",
	"state": "off"
})"""sv;

					mosquitto_publish(mosquitto, nullptr, topic.c_str(), static_cast<int>(size(payload)), &payload[0], 0, true);

					peekaboo = !peekaboo;
				}
			}
	});
}

Client::~Client()
{
	//mosquitto_disconnect(mosquitto.get());
	if (client_thread.joinable())
		client_thread.join();
}

void Client::on_connect(struct mosquitto*, void*, int)
{
	log("connected to broker");
}

void Client::on_subscribe(struct mosquitto*, void*, int, int, const int*)
{
	log("subscribed to topic");
}

void Client::on_publish(struct mosquitto*, void*, int)
{
}

void Client::on_message(struct mosquitto*, void* obj, const mosquitto_message* msg)
{
	using namespace std::literals;

	auto payload = std::string_view(static_cast<const char*>(msg->payload), msg->payloadlen);

	auto self = static_cast<Client*>(obj);
	if (payload == "turn_on"sv)
	{
		log("camera turning on");
		self->on.store(true, std::memory_order_relaxed);
	}
	else if (payload == "turn_off"sv)
	{
		log("camera turning off");
		self->on.store(false, std::memory_order_relaxed);
	}
	else
	{
		log("unknown message");
	}

	log("message: ", payload);
}

void Client::on_log(struct mosquitto*, void*, int, const char* msg)
{
	log(msg);
}

void Client::on_disconnect(struct mosquitto*, void*, int)
{
	log("disconnected");
}
