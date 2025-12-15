# modules/network/vpc/main.tf

# ----------------------------------------------------
# 1. Data Source: AZ 정보 가져오기 (a, b AZ 매핑용)
# ----------------------------------------------------
data "aws_availability_zones" "available" {
  state  = "available"
  filter {
    name   = "zone-name"
    values = [
      "${var.aws_region}a",
      "${var.aws_region}b"
    ]
  }
}

# ----------------------------------------------------
# 2. VPC 및 인터넷 게이트웨이 (IGW)
# ----------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr_block # 10.0.0.0/16
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${var.project_name}-igw" # 사용자 요청 이름
  }
}

# ----------------------------------------------------
# 3. 서브넷 (Public: 10.0.1.0/24, 10.0.2.0/24)
# ----------------------------------------------------
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true 
  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}"
  }
}

# 4. 서브넷 (Private: 10.0.11.0/24, 10.0.12.0/24)
resource "aws_subnet" "private" {
  count                   = length(var.private_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false
  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 11}"
  }
}

# ----------------------------------------------------
# 5. Route Tables (라우팅 테이블)
# ----------------------------------------------------

# Public Route Table (0.0.0.0/0 -> IGW)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "${var.project_name}-public-rt" } # 사용자 요청 이름
}

# Private Route Table (인터넷 경로 없음 - 오직 내부 VPC 통신만 허용)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  # 💡 주석: NAT Gateway를 사용하지 않으므로, 0.0.0.0/0 경로는 설정하지 않습니다.
  #         이 테이블은 기본적으로 내부 VPC 통신(10.0.0.0/16)만 관리합니다.
  tags = { Name = "${var.project_name}-private-rt" } # 사용자 요청 이름
}

# 6. Route Table - Subnet 연결
resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}