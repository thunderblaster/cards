CREATE TABLE `log_user` (
  `name` text NOT NULL,
  `room` text NOT NULL,
  `ip_addr` text NOT NULL,
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
