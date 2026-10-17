# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["backend.csproj", "./"]
RUN dotnet restore "backend.csproj"

# Copy full backend source and build release artifacts
COPY . .
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose HTTP port (Render uses 10000 by default)
EXPOSE 10000 8080
ENV PORT=10000
ENV ASPNETCORE_URLS=http://+:10000;http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "backend.dll"]
