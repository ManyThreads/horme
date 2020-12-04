#ifndef INCLUDED_FRAME_QUEUE
#define INCLUDED_FRAME_QUEUE

#include <atomic>


template <typename T>
class FrameQueue
{
	unsigned int front_buffer = 2;
	unsigned int back_buffer = 1;
	std::atomic<unsigned int> next_frame = front_buffer;
	std::atomic<unsigned int> free_frame = 0;

	T frames[3];

public:
	T& swap()
	{
		if (auto next = next_frame.load(std::memory_order_relaxed); next != front_buffer)
		{
			free_frame.store(front_buffer, std::memory_order_relaxed);
			front_buffer = next;
		}

		return frames[front_buffer];
	}

	T& push()
	{
		if (auto next = free_frame.load(std::memory_order_relaxed); next != back_buffer)
		{
			next_frame.store(back_buffer, std::memory_order_relaxed);
			back_buffer = next;
		}

		return frames[back_buffer];
	}
};

#endif
