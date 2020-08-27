#include <cstring>
#include <stdexcept>
#include <charconv>
#include <system_error>
#include <iostream>
#include <string>

#ifdef _WIN32
#include "win32/com_utils.h"
#include "win32/mf_utils.h"
#include "win32/display.h"
#endif
#include "camera.h"
#include "tracker.h"
#include "client.h"


namespace
{
	struct usage_error : std::runtime_error
	{
		using std::runtime_error::runtime_error;
	};

	std::ostream& print_usage(std::ostream& out)
	{
		return out << "usage: motion_sensor <mqtt-host-name> <mqtt-host-port> <uuid> <mqtt-topic>\n";
	}
}

int main(int argc, const char* argv[])
{
	try
	{
		if (argc != 5)
			throw usage_error("invalid number of arguments");

		const std::string uuid(argv[1]);
		const std::string mqtt_topic_base(argv[2]);
		const std::string host_str(argv[3]);

		std::string mqtt_host_name; //FIXME: hack
		if (host_str == "tcp://134.60.64.118:1883") {
			mqtt_host_name = "134.60.64.118";
		} else if (host_str == "tcp://mosquitto:1883") {
			mqtt_host_name = "mosquitto";
		} else {
			mqtt_host_name = "localhost";
		}

		int mqtt_host_port;
		if (auto [p, ec] = std::from_chars(argv[4], argv[4] + std::strlen(argv[4]), mqtt_host_port); ec != std::errc())
			throw usage_error("invalid port number");

		const std::string mqtt_topic = "data/" + mqtt_topic_base + '/' + uuid;

		MQTT::scope mosquitto;
#ifdef _WIN32
		COM::scope com(COINIT_MULTITHREADED);
		MF::scope mf(MFSTARTUP_LITE);

		Display display;
		Tracker tracker(&display);
#else
		Tracker tracker;
#endif
		Camera camera;

		std::cout << "host = " << mqtt_host_name << std::endl;
		std::cout << mqtt_topic << std::endl;

		Client client(
			mqtt_host_name.c_str(),
			mqtt_host_port,
			uuid.c_str(),
			mqtt_topic.c_str()
		);

		camera.record(tracker);

#ifdef _WIN32
		display.show();
#endif

		return 0;
	}
	catch (const usage_error& e)
	{
		std::cerr << e.what() << '\n' << print_usage << '\n';
	}
	catch (const std::exception& e)
	{
		std::cerr << "ERROR: " << e.what() << '\n';
		return -1;
	}
	catch (...)
	{
		std::cerr << "ERROR: unknown exception\n";
		return -128;
	}
}
