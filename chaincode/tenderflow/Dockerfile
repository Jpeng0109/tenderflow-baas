FROM golang:1.22-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
COPY vendor ./vendor
COPY tenderflow.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /chaincode/tenderflow .

FROM golang:1.22-alpine
RUN apk add --no-cache ca-certificates
COPY --from=builder /chaincode/tenderflow /usr/local/bin/tenderflow
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
EXPOSE 9999
CMD ["tenderflow"]
