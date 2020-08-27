#ifndef INCLUDED_MQTT_UTILS
#define INCLUDED_MQTT_UTILS

#include <stdexcept>
#include <memory>

#include <mosquitto.h>


namespace MQTT
{
	inline int throw_error(int ec)
	{
		if (ec != MOSQ_ERR_SUCCESS)
			throw std::runtime_error(mosquitto_strerror(ec));
		return ec;
	}

	struct scope
	{
		scope()
		{
			throw_error(mosquitto_lib_init());
		}

		~scope()
		{
			mosquitto_lib_cleanup();
		}
	};

	struct mosquitto_deleter
	{
		void operator ()(mosquitto* mq) const
		{
			mosquitto_destroy(mq);
		}
	};

	using unique_mosquitto = std::unique_ptr<mosquitto, mosquitto_deleter>;

	inline unique_mosquitto create_mosquitto(const char* id, bool clean_session, void* ctx)
	{
		auto mq = mosquitto_new(id, clean_session, ctx);
		if (!mq)
			throw std::runtime_error("failed to create mosquitto");
		return unique_mosquitto(mq);
	}
}

#endif
