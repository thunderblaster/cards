docker build -t cards -t cards:$(git log -1 --format=%h) --build-arg git_hash=$(git log -1 --format=%h) --build-arg git_date=$(git log -1 --format=%cd --date=short) --build-arg git_branch=$(git rev-parse --abbrev-ref HEAD) .
