#include <utility>
#include <algorithm>
#include <iterator>
#include <stdexcept>

#include "tracker.h"


Tracker::Tracker(FrameSink* sink)
	: sink(sink)
{
}

void Tracker::resize(int frame_width, int frame_height)
{
	width = frame_width;
	height = frame_height;

	mean = image<float>(width, height);
	weight = image<float>(width, height);
	variance = image<float>(width, height);
	num_modes = image<char>(width, height);

	using std::begin, std::end;
	std::fill(begin(mean), end(mean), 0.0f);
	std::fill(begin(weight), end(weight), 0.0f);
	std::fill(begin(variance), end(variance), 0.0f);
	std::fill(begin(num_modes), end(num_modes), static_cast<char>(0));
}

void Tracker::update(frame_data& /*frame*/)
{
}

void Tracker::consume(int frame_width, int frame_height, FrameSource& frame_source)
{
	if (frame_width != width || frame_height != height)
		resize(frame_width, frame_height);

	auto& frame = frame_queue.push();

	auto data = std::unique_ptr<std::uint32_t[]>(new std::uint32_t[frame_width * frame_height]);

	frame_source.produce(&data[0]);

	frame.width = frame_width;
	frame.height = frame_height;
	frame.data = std::move(data);



	if (sink)
	{
		class frame_source : public virtual FrameSource
		{
			frame_data& frame;

		public:
			frame_source(frame_data& frame)
				: frame(frame)
			{
			}

			void produce(std::uint32_t* data) override
			{
				for (int y = 0; y < frame.height; ++y)
				{
					for (int x = 0; x < frame.width; ++x)
					{
						*data++ = frame.data[y * frame.width + x];
					}
				}
			}
		} frame_source(frame);

		sink->consume(width, height, frame_source);
		//sink->consume(width, height, frame_source);
	}
}
